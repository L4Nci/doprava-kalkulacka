import { useState, useEffect } from 'react';
import MainApp from './components/MainApp';
import AdminLogin from './components/AdminLogin';
import Admin from './components/Admin';

// API base URL - upravit cestu
const API_URL = import.meta.env.PROD 
  ? '/.netlify/functions'
  : 'http://localhost:3001';

// Nahraďte všechny SVG ikony za tyto validní verze
const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
  </svg>
);

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
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return;
      } catch (error) {
        console.error(`Attempt ${i + 1} failed:`, error);
        if (i === retryCount - 1) {
          setError(`Nepodařilo se zaznamenat akci: ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
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
