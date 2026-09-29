import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Missing authorization token' })
      };
    }

    const token = authHeader.slice(7);
    const {
      data: { user },
      error: authError
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid authorization token' })
      };
    }

    const { data: adminProfile, error: adminError } = await adminClient
      .from('admin_profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (adminError) {
      console.error('Admin verification error:', adminError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Unable to verify admin' })
      };
    }

    if (!adminProfile?.is_super_admin) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Admin access required' })
      };
    }

    const { action, details } = JSON.parse(event.body || '{}');
    if (!action || typeof action !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid action' })
      };
    }

    const { data, error } = await adminClient
      .from('audit_log')
      .insert({
        action,
        details: details ?? null,
        user_id: user.id,
        user_email: user.email,
        ip_address:
          event.headers['x-nf-client-connection-ip'] ||
          event.headers['client-ip'] ||
          'unknown'
      })
      .select()
      .single();

    if (error) {
      console.error('Audit insert error:', error);
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data })
    };
  } catch (error) {
    console.error('Audit function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to write audit log' })
    };
  }
};
