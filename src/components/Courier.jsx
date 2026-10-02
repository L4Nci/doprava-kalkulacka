import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { EditIcon, DeleteIcon, CheckIcon } from './icons';

import { createAdminMutations, positiveInteger } from '../services/adminMutations'
import { useAdminMutation } from '../hooks/useAdminMutation'

const mutations = createAdminMutations(supabase)

const Courier = () => {
  const mutation = useAdminMutation()
  const [priceDraft, setPriceDraft] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [loadError, setLoadError] = useState(null)
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

  const fetchCarriers = useCallback(async () => {
    setLoadError(null);
    try {
      const { data, error } = await supabase.from('carriers').select('*, services(*)');
      if (error) throw error;
      setCarriers(data || []);
      return data || [];
    } catch (failure) {
      setLoadError('Nepodařilo se načíst dopravce. Obnovte data.');
      throw failure;
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchCarriers().catch(() => {}); }, [fetchCarriers]);

  const updateCarrier = async (carrierId) => {
    await mutation.run(async () => {
      if (!nameDraft.trim()) throw new Error('Vyplňte název dopravce.');
      await mutations.update('carriers', carrierId, { name: nameDraft.trim() });
      await fetchCarriers();
    });
    setEditingCarrier(null);
  };

  const updateService = async (serviceId, updates) => {
    await mutation.run(async () => {
      await mutations.update('services', serviceId, updates);
      await fetchCarriers();
    });
    setEditingService(null);
    setPriceDraft('');
  };

  const updateServicePrice = async (serviceId) => {
    await mutation.run(async () => {
      const price = positiveInteger(priceDraft, 'Cena', 0);
      await mutations.update('services', serviceId, { price_per_unit: price });
      await fetchCarriers();
    });
    setEditingService(null);
    setPriceDraft('');
  };

  const addNewCarrier = () => mutation.run(async () => {
    await mutations.createCarrier(newCarrier);
    await fetchCarriers();
    setShowNewCarrierForm(false);
    setNewCarrier({ name: '', logo_url: '', supported_countries: [],
      services: [{ name: '', shipment_type: 'balik', price_per_unit: 0 }] });
  });

  const deleteCarrier = (carrierId) => {
    setDeletingCarrier(carrierId);
    setDeleteConfirmation('');
  };

  const confirmDelete = () => {
    if (deleteConfirmation.toLowerCase() !== 'smazat') return;
    return mutation.run(async () => {
      await mutations.remove('carriers', deletingCarrier);
      await fetchCarriers();
      setDeletingCarrier(null);
      setDeleteConfirmation('');
    });
  };

  if (isLoading) {
    return <p className="text-gray-600">Načítám dopravce...</p>
  }

  return (
    <div className="p-4">
      {(mutation.error || loadError) && <div role="alert" className="sticky top-4 z-[11000] mb-4 bg-red-100 text-red-800 p-4 rounded">
        {mutation.error || loadError}
        <button disabled={mutation.pending} className="ml-4 underline" onClick={() => { mutation.clearError(); mutation.run(fetchCarriers); }}>Obnovit data</button>
      </div>}
      {mutation.pending && <p role="status">Ověřuji zápis v databázi…</p>}
      <fieldset disabled={mutation.pending || Boolean(loadError)} className="min-w-0">
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
                        services[index].price_per_unit = e.target.value
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
                {editingCarrier === `name-${carrier.id}` ? (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') updateCarrier(carrier.id); }}
                      className="border rounded px-2 py-1 flex-1"
                    />
                    <button
                      onClick={() => updateCarrier(carrier.id)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <CheckIcon />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-2">
                    <h3 className="text-lg font-semibold">{carrier.name}</h3>
                    <button
                      onClick={() => { setNameDraft(carrier.name); setEditingCarrier(`name-${carrier.id}`); }}
                      className="text-gray-400 hover:text-blue-600"
                      title="Upravit název"
                    >
                      <EditIcon />
                    </button>
                  </div>
                )}
                <p className="text-sm text-gray-600 mt-1">
                  Podporované země: {carrier.supported_countries?.join(', ')}
                </p>
              </div>
              <button
                onClick={() => deleteCarrier(carrier.id)}
                className="text-red-500 hover:text-red-700 p-1"
                title="Smazat dopravce"
              >
                <DeleteIcon />
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
                  <div className="text-center">
                    {editingService === `type-${service.id}` ? (
                      <div className="flex items-center justify-center gap-2">
                        <select
                          value={service.shipment_type}
                          onChange={(e) => updateService(service.id, { shipment_type: e.target.value })}
                          className="border rounded px-2 py-1"
                        >
                          <option value="balik">Balík</option>
                          <option value="paleta">Paleta</option>
                        </select>
                        <button
                          onClick={() => setEditingService(null)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <CheckIcon />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-gray-600">
                          {service.shipment_type === 'balik' ? 'Balík' : 'Paleta'}
                        </span>
                        <button
                          onClick={() => setEditingService(`type-${service.id}`)}
                          className="text-gray-400 hover:text-blue-600"
                          title="Změnit typ přepravy"
                        >
                          <EditIcon />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    {editingService === service.id ? (
                      <>
                        <input
                          type="number"
                          aria-label="Cena služby"
                          value={priceDraft}
                          onChange={(e) => setPriceDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') updateServicePrice(service.id); }}
                          className="border rounded w-20 px-2 py-1 text-right"
                        />
                        <button
                          aria-label="Uložit cenu"
                          onClick={() => updateServicePrice(service.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <CheckIcon />
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{service.price_per_unit}</span>
                        <button
                          onClick={() => { setPriceDraft(String(service.price_per_unit)); setEditingService(service.id); }}
                          className="text-gray-400 hover:text-blue-600"
                          title="Upravit cenu"
                        >
                          <EditIcon />
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
      </fieldset>
    </div>
  )
}

export default Courier
