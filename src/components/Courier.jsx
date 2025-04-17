import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const Courier = () => {
  const [carriers, setCarriers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingCarrier, setEditingCarrier] = useState(null)
  const [editingService, setEditingService] = useState(null)
  const [showNewCarrierForm, setShowNewCarrierForm] = useState(false)
  const [newCarrier, setNewCarrier] = useState({
    name: '',
    logo_url: '',
    supported_countries: [],
    services: [{ name: '', shipment_type: 'balik', price_per_unit: 0 }]
  })
  const [deletingCarrier, setDeletingCarrier] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

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

  const addNewCarrier = async () => {
    try {
      const { data: carrier, error: carrierError } = await supabase
        .from('carriers')
        .insert([{
          name: newCarrier.name,
          logo_url: newCarrier.logo_url,
          supported_countries: newCarrier.supported_countries
        }])
        .select()

      if (carrierError) throw carrierError

      const servicesWithCarrierId = newCarrier.services.map(service => ({
        ...service,
        carrier_id: carrier[0].id
      }))

      const { data: services, error: servicesError } = await supabase
        .from('services')
        .insert(servicesWithCarrierId)

      if (servicesError) throw servicesError

      setCarriers([...carriers, { ...carrier[0], services: services }])
      setShowNewCarrierForm(false)
      setNewCarrier({
        name: '',
        logo_url: '',
        supported_countries: [],
        services: [{ name: '', shipment_type: 'balik', price_per_unit: 0 }]
      })
    } catch (err) {
      console.error('Chyba při vytváření dopravce:', err)
    }
  }

  const deleteCarrier = async (carrierId) => {
    setDeletingCarrier(carrierId);
    setDeleteConfirmation('');
  };

  const confirmDelete = async () => {
    if (deleteConfirmation.toLowerCase() !== 'smazat') return;

    try {
      // Nejprve smažeme všechny služby dopravce
      await supabase
        .from('services')
        .delete()
        .eq('carrier_id', deletingCarrier);

      // Potom smažeme samotného dopravce
      const { error } = await supabase
        .from('carriers')
        .delete()
        .eq('id', deletingCarrier);

      if (error) throw error;

      setCarriers(carriers.filter(c => c.id !== deletingCarrier));
      setDeletingCarrier(null);
      setDeleteConfirmation('');
    } catch (err) {
      console.error('Chyba při mazání dopravce:', err);
    }
  };

  if (isLoading) {
    return <p className="text-gray-600">Načítám dopravce...</p>
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Dopravci</h2>
        <button
          onClick={() => setShowNewCarrierForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Přidat dopravce
        </button>
      </div>

      {showNewCarrierForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h3 className="text-xl font-bold mb-4">Nový dopravce</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block mb-1">Název dopravce</label>
                <input
                  type="text"
                  value={newCarrier.name}
                  onChange={(e) => setNewCarrier({ ...newCarrier, name: e.target.value })}
                  className="border p-2 w-full rounded"
                />
              </div>

              <div>
                <label className="block mb-1">URL loga</label>
                <input
                  type="text"
                  value={newCarrier.logo_url}
                  onChange={(e) => setNewCarrier({ ...newCarrier, logo_url: e.target.value })}
                  className="border p-2 w-full rounded"
                />
              </div>

              <div>
                <label className="block mb-1">Podporované země</label>
                <div className="grid grid-cols-2 gap-2">
                  {['CZ', 'SK', 'PL', 'HU', 'DE', 'HR', 'SI'].map(country => (
                    <label key={country} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newCarrier.supported_countries.includes(country)}
                        onChange={(e) => {
                          const countries = e.target.checked
                            ? [...newCarrier.supported_countries, country]
                            : newCarrier.supported_countries.filter(c => c !== country)
                          setNewCarrier({ ...newCarrier, supported_countries: countries })
                        }}
                        className="mr-2"
                      />
                      {country}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-1">Služby</label>
                {newCarrier.services.map((service, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Název služby"
                      value={service.name}
                      onChange={(e) => {
                        const services = [...newCarrier.services]
                        services[index].name = e.target.value
                        setNewCarrier({ ...newCarrier, services })
                      }}
                      className="border p-2 flex-1 rounded"
                    />
                    <select
                      value={service.shipment_type}
                      onChange={(e) => {
                        const services = [...newCarrier.services]
                        services[index].shipment_type = e.target.value
                        setNewCarrier({ ...newCarrier, services })
                      }}
                      className="border p-2 rounded"
                    >
                      <option value="balik">Balík</option>
                      <option value="paleta">Paleta</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Cena"
                      value={service.price_per_unit}
                      onChange={(e) => {
                        const services = [...newCarrier.services]
                        services[index].price_per_unit = parseInt(e.target.value)
                        setNewCarrier({ ...newCarrier, services })
                      }}
                      className="border p-2 w-24 rounded"
                    />
                  </div>
                ))}
                <button
                  onClick={() => setNewCarrier({
                    ...newCarrier,
                    services: [...newCarrier.services, { name: '', shipment_type: 'balik', price_per_unit: 0 }]
                  })}
                  className="text-blue-600 hover:text-blue-800"
                >
                  + Přidat službu
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowNewCarrierForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Zrušit
              </button>
              <button
                onClick={addNewCarrier}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Vytvořit dopravce
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingCarrier && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Potvrzení smazání</h3>
            <p className="mb-4">Pro smazání dopravce napište "smazat"</p>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="border p-2 w-full rounded mb-4"
              placeholder="smazat"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDeletingCarrier(null);
                  setDeleteConfirmation('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Zrušit
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmation.toLowerCase() !== 'smazat'}
                className={`bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 
                  ${deleteConfirmation.toLowerCase() !== 'smazat' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Smazat dopravce
              </button>
            </div>
          </div>
        </div>
      )}

      {carriers.length === 0 && <p>Žádní dopravci nebyli nalezeni.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {carriers.map((carrier) => (
          <div key={carrier.id} className="border rounded-lg p-4 shadow-md bg-white">
            <div className="flex justify-between items-start mb-4">
              <div className="w-full">
                {carrier.logo_url && (
                  <img 
                    src={carrier.logo_url} 
                    alt={carrier.name} 
                    className="h-12 object-contain" 
                  />
                )}
                <h3 className="text-lg font-semibold mt-2">{carrier.name}</h3>
                <p className="text-sm text-gray-600">
                  Podporované země: {carrier.supported_countries?.join(', ')}
                </p>
              </div>
              <button
                onClick={() => deleteCarrier(carrier.id)}
                className="text-red-500 hover:text-red-700 p-1"
                title="Smazat dopravce"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 111.414 1.414L11.414 10l4.293 4.293a1 1 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 01-1.414-1.414L8.586 10 4.293 5.707a1 1 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <div className="border rounded overflow-hidden">
              <div className="grid grid-cols-3 bg-gray-50 p-2 border-b text-sm font-medium text-center">
                <div>Název služby</div>
                <div>Typ přepravy</div>
                <div>Cena za jednotku (Kč)</div>
              </div>
              {carrier.services?.map((service) => (
                <div key={service.id} className="grid grid-cols-3 p-2 border-b last:border-b-0 hover:bg-gray-50">
                  <div className="text-center">{service.name}</div>
                  <div className="text-center text-gray-600">
                    {service.shipment_type === 'balik' ? 'Balík' : 'Paleta'}
                  </div>
                  <div className="flex items-center justify-center gap-2">
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
                          className="border rounded w-20 px-2 py-1 text-right"
                        />
                        <button
                          onClick={() => setEditingService(null)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ✓
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{service.price_per_unit}</span>
                        <button
                          onClick={() => setEditingService(service.id)}
                          className="text-gray-400 hover:text-blue-600"
                          title="Upravit cenu"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                      </div>
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
