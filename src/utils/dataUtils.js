import { logAuditEvent } from '../services/auditService';
import { supabase } from '../supabaseClient';

export const updateWithAudit = async (tableName, id, newData) => {
  // Načtení původních dat
  const { data: oldData } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', id)
    .single();

  // Provedení aktualizace
  const { data, error } = await supabase
    .from(tableName)
    .update(newData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Zalogování změny
  await logAuditEvent(
    'UPDATE',
    tableName,
    id,
    oldData,
    data
  );

  return data;
};

export const insertWithAudit = async (tableName, data) => {
  const { data: insertedData, error } = await supabase
    .from(tableName)
    .insert(data)
    .select()
    .single();

  if (error) throw error;

  await logAuditEvent(
    'INSERT',
    tableName,
    insertedData.id,
    null,
    insertedData
  );

  return insertedData;
};

export const deleteWithAudit = async (tableName, id) => {
  const { data: oldData } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq('id', id);

  if (error) throw error;

  await logAuditEvent(
    'DELETE',
    tableName,
    id,
    oldData,
    null
  );
};
