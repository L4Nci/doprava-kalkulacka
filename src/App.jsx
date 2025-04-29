import { useState, useEffect } from 'react';
import MainApp from './components/MainApp';
import AdminLogin from './components/AdminLogin';
import Admin from './components/Admin';
import { EditIcon, CloseIcon } from './components/icons';

// API base URL - upravit cestu
const API_URL = import.meta.env.PROD 
  ? '/.netlify/functions'  // Používáme Netlify Functions v produkci
  : 'http://localhost:3001';

export default function App() {
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');

  useEffect(() => {
    checkServer();
  }, []);

  const checkServer = async () => {
    if (import.meta.env.PROD) {
      // V produkci předpokládáme, že server běží
      setServerStatus('connected');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) {
        setServerStatus('connected');
      } else {
        setServerStatus('error');
      }
    } catch {
      setServerStatus('error');
    }
  };

  const logToAudit = async (action, retryCount = 3) => {
    if (!import.meta.env.PROD && serverStatus === 'error') {
      console.warn('Lokální server není dostupný, audit log se nezapíše');
      return;
    }

    for (let i = 0; i < retryCount; i++) {
      try {
        const response = await fetch(`${API_URL}/audit-log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action,
            timestamp: new Date().toISOString()
          })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP error! status: ${response.status}`);
        return data;
      } catch (error) {
        console.error(`Attempt ${i + 1} failed:`, error);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    // Pouze po všech neúspěšných pokusech nastavíme error
    setError('Nepodařilo se zaznamenat akci po několika pokusech');
  };

  const handleAdminSuccess = async () => {
    setIsAdminLoggedIn(true);
    await logToAudit('ADMIN_LOGIN');
  };

  const handleLogout = async () => {
    await logToAudit('ADMIN_LOGOUT');
    setShowAdmin(false);
    setIsAdminLoggedIn(false);
  };

  if (serverStatus === 'error') {
    return (
      <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        Server není dostupný. Zkontrolujte, že běží na portu 3001.
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
        <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
      </div>
    );
  }

  return (
    <div>
      {!showAdmin && (
        <div>
          <MainApp />
          <button
            onClick={() => setShowAdmin(true)}
            className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-md"
          >
            Admin
          </button>
        </div>
      )}

      {showAdmin && !isAdminLoggedIn && (
        <div>
          <AdminLogin onSuccess={handleAdminSuccess} />
          <button
            onClick={() => setShowAdmin(false)}
            className="fixed top-4 left-4 bg-gray-600 text-white px-4 py-2 rounded-md"
          >
            Zpět
          </button>
        </div>
      )}

      {showAdmin && isAdminLoggedIn && (
        <div>
          <Admin />
          <button
            onClick={handleLogout}
            className="fixed top-4 right-4 bg-gray-600 text-white px-4 py-2 rounded-md"
          >
            Odhlásit
          </button>
        </div>
      )}
    </div>
  );
}
