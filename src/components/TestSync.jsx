import { useState, useEffect } from 'react'
import { useProducts } from '../hooks/useProducts'
import { supabase } from '../lib/supabaseClient'

export function TestSync() {
  const { products, isLoading, error, lastSync, refetch } = useProducts()
  const [testStatus, setTestStatus] = useState([])

  const addTestLog = (message) => {
    setTestStatus(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }

  const runTest = async () => {
    addTestLog('Starting sync test...')
    
    // Test 1: Změna produktu
    try {
      const testProduct = products[0]
      if (testProduct) {
        addTestLog(`Updating product ${testProduct.name}...`)
        
        const { error } = await supabase
          .from('products')
          .update({ items_per_pallet: Math.floor(Math.random() * 100) + 1 })
          .eq('id', testProduct.id)

        if (error) throw error
        
        addTestLog('Update successful, waiting for sync...')
      }
    } catch (err) {
      addTestLog(`Test failed: ${err.message}`)
    }
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Test Synchronizace</h2>
      
      <div className="mb-4">
        <p>Poslední synchronizace: {lastSync || 'Nikdy'}</p>
        <p>Počet produktů: {products.length}</p>
        <p>Status: {isLoading ? 'Načítám...' : 'Připraveno'}</p>
        {error && <p className="text-red-500">Error: {error}</p>}
      </div>

      <div className="space-x-2">
        <button 
          onClick={runTest}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Spustit test
        </button>
        <button 
          onClick={refetch}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Force Refresh
        </button>
      </div>

      <div className="mt-4 p-2 bg-gray-100 rounded max-h-60 overflow-auto">
        {testStatus.map((log, i) => (
          <div key={i} className="text-sm font-mono">{log}</div>
        ))}
      </div>
    </div>
  )
}
