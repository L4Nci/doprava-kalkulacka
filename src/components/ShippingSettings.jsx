import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const ShippingSettings = () => {
  const [shippingMethods, setShippingMethods] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingField, setEditingField] = useState(null)

  useEffect(() => {
    fetchShippingMethods()
  }, [])

  const fetchShippingMethods = async () => {
    const { data, error } = await supabase
      .from('shipping_methods')
      .select('*')

    if (error) {
      console.error('Chyba při načítání:', error)
    } else {
      setShippingMethods(data || [])
    }
    setIsLoading(false)
  }

  const updateMethod = async (id, updates) => {
    try {
      const { error } = await supabase
        .from('shipping_methods')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      setShippingMethods(methods => 
        methods.map(m => m.id === id ? { ...m, ...updates } : m)
      )
      setEditingField(null)
    } catch (err) {
      console.error('Chyba při ukládání:', err)
    }
  }

  if (isLoading) return <div>Načítám...</div>

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Nastavení dopravců</h2>
      <div className="space-y-4">
        {shippingMethods.map(method => (
          <div key={method.id} className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="space-y-4">
              {/* Název dopravy */}
              <div>
                <div className="text-sm text-gray-600 mb-1">Název dopravy</div>
                {editingField === `name-${method.id}` ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={method.name || ''}
                      onChange={(e) => updateMethod(method.id, { name: e.target.value })}
                      className="border rounded px-2 py-1 flex-1"
                    />
                    <button
                      onClick={() => setEditingField(null)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{method.name}</span>
                    <button
                      onClick={() => setEditingField(`name-${method.id}`)}
                      className="text-gray-400 hover:text-blue-600"
                      title="Upravit název"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Podporované země */}
              <div>
                <div className="text-sm text-gray-600 mb-1">Podporované země</div>
                {editingField === `countries-${method.id}` ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={method.supported_countries || ''}
                      onChange={(e) => updateMethod(method.id, { supported_countries: e.target.value })}
                      className="border rounded px-2 py-1 flex-1"
                      placeholder="CZ, SK"
                    />
                    <button
                      onClick={() => setEditingField(null)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>{method.supported_countries || '—'}</span>
                    <button
                      onClick={() => setEditingField(`countries-${method.id}`)}
                      className="text-gray-400 hover:text-blue-600"
                      title="Upravit podporované země"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ShippingSettings
