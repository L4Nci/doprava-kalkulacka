import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function AdminManager() {
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [admins, setAdmins] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    const { data } = await supabase
      .from('admin_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setAdmins(data || []);
  };

  const addNewAdmin = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      // 1. Vytvořit uživatele v auth
      const { data, error } = await supabase.auth.admin.createUser({
        email: newAdminEmail,
        email_confirm: true,
        password: crypto.randomUUID() // náhodné heslo
      });

      if (error) throw error;

      // 2. Přidat do admin_profiles
      const { error: profileError } = await supabase
        .from('admin_profiles')
        .insert([{
          id: data.user.id,
          email: newAdminEmail,
          full_name: 'Nový Admin',
          is_super_admin: false
        }]);

      if (profileError) throw profileError;

      // 3. Poslat reset hesla
      await supabase.auth.resetPasswordForEmail(newAdminEmail);

      setMessage(`Admin přidán! Email pro nastavení hesla byl odeslán na ${newAdminEmail}`);
      setNewAdminEmail('');
      loadAdmins();
    } catch (error) {
      setMessage(`Chyba: ${error.message}`);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Správa adminů</h2>
      
      <form onSubmit={addNewAdmin} className="mb-6">
        <div className="flex gap-2">
          <input
            type="email"
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            placeholder="Email nového admina"
            className="flex-1 p-2 border rounded"
            required
          />
          <button 
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Přidat admina
          </button>
        </div>
      </form>

      {message && (
        <div className={`p-4 rounded mb-4 ${
          message.includes('Chyba') ? 'bg-red-100' : 'bg-green-100'
        }`}>
          {message}
        </div>
      )}

      <div className="mt-4">
        <h3 className="font-bold mb-2">Seznam adminů:</h3>
        <div className="space-y-2">
          {admins.map(admin => (
            <div key={admin.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div>
                <p className="font-medium">{admin.full_name}</p>
                <p className="text-sm text-gray-600">{admin.email}</p>
              </div>
              {admin.is_super_admin && (
                <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                  Super Admin
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
