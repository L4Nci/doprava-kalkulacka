import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const Courier = () => {
  const [carriers, setCarriers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingCarrier, setEditingCarrier] = useState(null)
  const [editingService, setEditingService] = useState(null)

  useEffect(() => {
    const fetchCarriers = async () => {
      const { data, error } = await supabase
        .from('carriers')
        .select('*, services(*)')

      if (error) {
        console.error('Chyba při načítání:', error)
      } else {
        setCarriers(data)
      }
      setIsLoading(false)
    }

    fetchCarriers()
  }, [])

  const updateCarrier = async (carrierId, updates) => {
    try {
      const { data, error } = await supabase
        .from('carriers')
        .update(updates)
        .eq('id', carrierId)

      if (error) throw error

      setCarriers(carriers.map(c => 
        c.id === carrierId ? { ...c, ...updates } : c
      ))
      setEditingCarrier(null)
    } catch (err) {
      console.error('Chyba při ukládání:', err)
    }
  }

  const updateServicePrice = async (serviceId, newPrice) => {
    try {
      const { data, error } = await supabase
        .from('services')
        .update({ price_per_unit: newPrice })
        .eq('id', serviceId)

      if (error) throw error

      setCarriers(carriers.map(carrier => ({
        ...carrier,
        services: carrier.services.map(service =>
          service.id === serviceId
            ? { ...service, price_per_unit: newPrice }
            : service
        )
      })))
    } catch (err) {
      console.error('Chyba při aktualizaci ceny:', err)
    }
  }

  if (isLoading) {
    return <p className="text-gray-600">Načítám dopravce...</p>
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Dopravci</h2>
      
      {carriers.length === 0 && <p>Žádní dopravci nebyli nalezeni.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {carriers.map((carrier) => (
          <div key={carrier.id} className="border rounded-lg p-4 shadow-md bg-white mb-4">
            {carrier.logo_url && (
              <img 
                src={carrier.logo_url} 
                alt={carrier.name} 
                className="h-12 object-contain mb-3" 
              />
            )}
            <h3 className="text-lg font-semibold">{carrier.name}</h3>
            <p className="text-sm text-gray-600 mb-2">
              Podporované země: {carrier.supported_countries?.join(', ')}
            </p>
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Služby:</h4>
              {carrier.services?.map((service) => (
                <div key={service.id} className="flex items-center justify-between p-2 border-b">
                  <span>{service.name}</span>
                  <div className="flex items-center gap-2">
                    {editingService === service.id ? (
                      <>
                        <input
                          type="number"
                          value={service.price_per_unit}
                          onChange={(e) => {
                            const value = parseInt(e.target.value)
                            if (!isNaN(value)) {
                              updateServicePrice(service.id, value)
                            }
                          }}
                          className="border rounded w-24 px-2 py-1 text-right"
                        />
                        <button
                          onClick={() => setEditingService(null)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Hotovo
                        </button>
                      </>
                    ) : (
                      <>
                        <span>{service.price_per_unit} Kč/{service.shipment_type === 'balik' ? 'štítek' : 'paleta'}</span>
                        <button
                          onClick={() => setEditingService(service.id)}
                          className="text-gray-400 hover:text-blue-600"
                          title="Upravit cenu"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Courier
