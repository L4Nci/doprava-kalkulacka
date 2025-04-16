import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const Courier = () => {
  const [carriers, setCarriers] = useState([])
  const [isLoading, setIsLoading] = useState(true)

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

  if (isLoading) {
    return <p className="text-gray-600">Načítám dopravce...</p>
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Dopravci</h2>
      
      {carriers.length === 0 && <p>Žádní dopravci nebyli nalezeni.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {carriers.map((carrier) => (
          <div key={carrier.id} className="border rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow">
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
            <div className="mt-2">
              <p className="font-medium">Služby:</p>
              <ul className="space-y-1">
                {carrier.services?.map((service) => (
                  <li key={service.id} className="text-sm text-gray-700">
                    • {service.name} - {service.price_per_unit} Kč
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Courier
