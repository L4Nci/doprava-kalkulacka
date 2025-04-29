import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function TestLogin() {
  const [result, setResult] = useState('');

  const testLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'viktor@textilomanie.cz',
      password: 'hovno'
    });

    if (error) {
      setResult('Error: ' + error.message);
      console.error('Login details:', {
        error,
        session: data?.session,
        user: data?.user
      });
    } else {
      setResult('Success! User ID: ' + data.user.id);
      
      // Test admin access
      const { data: adminData, error: adminError } = await supabase
        .from('admin_profiles')
        .select('*')
        .single();
      
      console.log('Admin check:', { adminData, adminError });
    }
  };

  return (
    <div style={{padding: '20px'}}>
      <button onClick={testLogin}>Test Login</button>
      <pre>{result}</pre>
    </div>
  );
}
