import { supabase } from '../supabaseClient';

export const logAuditEvent = async (action, tableName, recordId, oldData, newData) => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error('No authenticated user found');
    return;
  }

  const { error } = await supabase.from('audit_log').insert([{
    user_id: user.id,
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData,
    new_data: newData
  }]);

  if (error) {
    console.error('Error logging audit event:', error);
    throw error;
  }
};

export const getAuditLog = async () => {
  const { data, error } = await supabase
    .from('audit_log')
    .select(`
      *,
      profiles:profiles(full_name)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching audit log:', error);
    throw error;
  }

  return data;
};
