import express from 'express';
import { supabase } from '../lib/supabaseClient';

const router = express.Router();

router.post('/audit-log', async (req, res) => {  // Změna cesty z /api/audit-log na /audit-log
  try {
    const { action, timestamp } = req.body;
    
    const { data, error } = await supabase
      .from('audit_log')
      .insert([{
        action,
        timestamp,
        user_id: req.user?.id || 'anonymous'
      }]);

    if (error) throw error;
    
    res.json({ success: true });
  } catch (error) {
    console.error('Audit log error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
