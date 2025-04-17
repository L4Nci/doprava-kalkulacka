import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AdminSettings = () => {
  const [settings, setSettings] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingField, setEditingField] = useState(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('shipping_methods')
      .select('*')

    if (error) {
      console.error('Chyba při načítání:', error)
    } else {
      setSettings(data || [])
    }
    setIsLoading(false)
  }

  const updateSetting = async (id, updates) => {
    try {
      const { error } = await supabase
        .from('shipping_methods')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      setSettings(settings.map(s => 
        s.id === id ? { ...s, ...updates } : s
      ))
      setEditingField(null)
    } catch (err) {
      console.error('Chyba při ukládání:', err)
    }
  }

  if (isLoading) return <div>Načítám nastavení...</div>

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Nastavení dopravců</h2>
      <div className="grid gap-4">
        {settings.map(method => (
          <div key={method.id} className="border rounded-lg p-4 bg-white">
            <div className="space-y-4">
              {/* Název dopravy */}
              <div>
                <div className="text-sm text-gray-600 mb-1">Název dopravy</div>
                {editingField === `name-${method.id}` ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={method.name}
                      onChange={(e) => updateSetting(method.id, { name: e.target.value })}
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
                    <span>{method.name}</span>
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

              {/* Typ přepravy */}
              <div>
                <div className="text-sm text-gray-600 mb-1">Typ přepravy</div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={method.shipment_type === 'balik'}
                      onChange={() => updateSetting(method.id, { shipment_type: 'balik' })}
                      className="mr-2"
                    />
                    Balíková přeprava
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={method.shipment_type === 'paleta'}
                      onChange={() => updateSetting(method.id, { shipment_type: 'paleta' })}
                      className="mr-2"
                    />
                    Paletová přeprava
                  </label>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AdminSettings
