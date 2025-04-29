import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  
  const handleReset = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      
      if (error) throw error;
      setMessage('Zkontrolujte svůj email pro reset hesla');
    } catch (error) {
      setMessage('Chyba: ' + error.message);
    }
  };

  return (
    <div>
      <h3>Reset hesla</h3>
      <form onSubmit={handleReset}>
        <input
          type="email"
          placeholder="Váš email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit">Poslat reset link</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
