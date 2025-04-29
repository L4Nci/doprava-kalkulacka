const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    };
  }

  try {
    const { action, timestamp } = JSON.parse(event.body);
    
    const { data, error } = await supabase
      .from('audit_log')
      .insert([{ 
        action,
        timestamp,
        user_ip: event.headers['client-ip'] || 'unknown'
      }]);

    if (error) throw error;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ success: true, data })
    };
  } catch (error) {
    console.error('Audit log error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
