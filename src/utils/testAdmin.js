import { supabase } from '../supabaseClient';

export const testAdminAccess = async () => {
  console.log('Testing admin access...');
  
  // Test 1: Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('Current user:', { user, userError });

  // Test 2: Direct admin_profiles query
  const { data: adminData, error: adminError } = await supabase
    .from('admin_profiles')
    .select('*');
  console.log('Admin profiles data:', { adminData, adminError });

  // Test 3: Specific admin query
  if (user) {
    const { data: specificAdmin, error: specificError } = await supabase
      .from('admin_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    console.log('Specific admin check:', { specificAdmin, specificError });
  }

  return { user, adminData };
};
