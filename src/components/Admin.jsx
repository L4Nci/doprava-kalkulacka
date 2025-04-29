import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import Courier from './Courier';
import Products from './Products';

function Admin({ onBack }) {
  const [activeTab, setActiveTab] = useState('carriers');
  const [adminInfo, setAdminInfo] = useState(null);

  useEffect(() => {
    async function getAdminInfo() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('admin_profiles')
        .select('*')
        .single();
      
      setAdminInfo(data);
    }

    getAdminInfo();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
        </div>

        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('carriers')}
                className={`${
                  activeTab === 'carriers'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } w-1/2 py-4 px-1 text-center border-b-2 font-medium`}
              >
                Dopravci
              </button>
              <button
                onClick={() => setActiveTab('products')}
                className={`${
                  activeTab === 'products'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } w-1/2 py-4 px-1 text-center border-b-2 font-medium`}
              >
                Produkty
              </button>
            </nav>
          </div>
        </div>

        {activeTab === 'carriers' && <Courier />}
        {activeTab === 'products' && <Products />}
      </div>
    </div>
  );
}

export default Admin;
