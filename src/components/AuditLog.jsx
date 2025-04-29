import { useState, useEffect } from 'react';
import { getAuditLog } from '../services/auditService';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAuditLog();
  }, []);

  const loadAuditLog = async () => {
    try {
      const data = await getAuditLog();
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Načítání...</div>;
  if (error) return <div className="text-red-500">Chyba: {error}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold mb-4">Historie změn</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-6 py-3 border-b text-left">Čas</th>
              <th className="px-6 py-3 border-b text-left">Uživatel</th>
              <th className="px-6 py-3 border-b text-left">Akce</th>
              <th className="px-6 py-3 border-b text-left">Tabulka</th>
              <th className="px-6 py-3 border-b text-left">Změny</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 border-b">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 border-b">
                  {log.profiles?.full_name}
                </td>
                <td className="px-6 py-4 border-b">
                  {log.action}
                </td>
                <td className="px-6 py-4 border-b">
                  {log.table_name}
                </td>
                <td className="px-6 py-4 border-b">
                  <details>
                    <summary>Zobrazit změny</summary>
                    <pre className="mt-2 text-sm">
                      {JSON.stringify({
                        old: log.old_data,
                        new: log.new_data
                      }, null, 2)}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
