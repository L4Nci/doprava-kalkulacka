import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { EditIcon, CheckIcon } from './icons';

import { createAdminMutations, positiveInteger } from '../services/adminMutations'
import { COUNTRIES } from '../config/countries'
import { filterCarriers } from '../utils/carrierFilters'
import { useAdminMutation } from '../hooks/useAdminMutation'

const mutations = createAdminMutations(supabase)

function CarrierLogo({ carrier }) {
  const [failed, setFailed] = useState(false)
  if (!carrier.logo_url || failed) return null
  return <img src={carrier.logo_url} alt={carrier.name} onError={() => setFailed(true)} className="h-9 w-16 shrink-0 object-contain" />
}

const Courier = () => {
  const mutation = useAdminMutation()
  const [priceDraft, setPriceDraft] = useState('')
  const [serviceNameDraft, setServiceNameDraft] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [logoDraft, setLogoDraft] = useState('')
  const [countriesDraft, setCountriesDraft] = useState([])
  const [status, setStatus] = useState('active')
  const [search, setSearch] = useState('')
  const [countries, setCountries] = useState([])
  const [type, setType] = useState('all')
  const [sort, setSort] = useState('asc')
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
  const [deleteBlockedCarrier, setDeleteBlockedCarrier] = useState(null);

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
    const saved = await mutation.run(async () => {
      if (!nameDraft.trim()) throw new Error('Vyplňte název dopravce.');
      await mutations.update('carriers', carrierId, {
        name: nameDraft.trim(),
        logo_url: logoDraft.trim() || null,
        supported_countries: countriesDraft
      });
      await fetchCarriers();
    });
    if (saved) setEditingCarrier(null);
  };

  const updateService = async (serviceId, updates) => {
    await mutation.run(async () => {
      await mutations.update('services', serviceId, updates);
      await fetchCarriers();
    });
    setEditingService(null);
    setPriceDraft('');
  };

  const updateServiceName = async (serviceId) => {
    const saved = await mutation.run(async () => {
      const name = serviceNameDraft.trim();
      if (!name) throw new Error('Vyplňte název služby.');
      await mutations.update('services', serviceId, { name });
      await fetchCarriers();
    });
    if (saved) {
      setEditingService(null);
      setServiceNameDraft('');
    }
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
    setDeleteBlockedCarrier(null);
  };

  const setCarrierActive = (carrierId, active) => mutation.run(async () => {
    await mutations.update('carriers', carrierId, { active });
    await fetchCarriers();
    setDeletingCarrier(null);
    setDeleteConfirmation('');
    setDeleteBlockedCarrier(null);
  });

  const confirmDelete = () => {
    if (deleteConfirmation.toLowerCase() !== 'smazat') return;
    return mutation.run(async () => {
      try {
        await mutations.remove('carriers', deletingCarrier);
      } catch (failure) {
        if (failure?.code === '23503') setDeleteBlockedCarrier(deletingCarrier);
        throw failure;
      }
      await fetchCarriers();
      setDeletingCarrier(null);
      setDeleteConfirmation('');
      setDeleteBlockedCarrier(null);
    });
  };

  const filteredCarriers = filterCarriers(carriers, { status, search, countries, type, sort });
  const activeCount = carriers.filter(carrier => carrier.active).length;
  const hasFilters = Boolean(search || countries.length || type !== 'all' || sort !== 'asc');
  const resetFilters = () => { setSearch(''); setCountries([]); setType('all'); setSort('asc'); };

  if (isLoading) {
    return <p className="text-gray-600">Načítám dopravce...</p>
  }

  return (
    <div className="p-2 sm:p-4 min-w-0">
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
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
                  {COUNTRIES.map(({ code: country, name }) => (
                    <label key={country} title={name} className="flex items-center">
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
                  <div key={index} className="flex flex-wrap gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Název služby"
                      value={service.name}
                      onChange={(e) => {
                        const services = [...newCarrier.services]
                        services[index].name = e.target.value
                        setNewCarrier({ ...newCarrier, services })
                      }}
                      className="border p-2 min-w-0 flex-1 rounded"
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
            {deleteBlockedCarrier === deletingCarrier && (
              <button
                onClick={() => setCarrierActive(deletingCarrier, false)}
                className="mb-4 bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700"
              >
                Deaktivovat dopravce
              </button>
            )}
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
                  setDeleteBlockedCarrier(null);
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

      <div role="group" aria-label="Stav dopravců" className="flex flex-wrap gap-2 mb-4">
        {[['active', 'Aktivní', activeCount], ['inactive', 'Neaktivní', carriers.length - activeCount], ['all', 'Všichni', carriers.length]].map(([value, label, count]) => (
          <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}
            className={`rounded px-4 py-2 font-medium ${status === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {label} ({count})
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-gray-50 p-3 mb-3">
        <label className="flex-1 basis-full xl:basis-64 min-w-0 text-sm font-medium">
          Vyhledávání
          <input type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Hledat dopravce nebo službu…" className="mt-1 block w-full border rounded p-2 font-normal" />
        </label>
        <details className="relative">
          <summary className="cursor-pointer border rounded bg-white px-3 py-2">{countries.length ? `Země (${countries.length})` : 'Všechny země'}</summary>
          <div className="absolute left-0 top-full mt-1 z-20 w-56 max-h-80 overflow-y-auto rounded border bg-white shadow-lg p-3 space-y-2" role="group" aria-label="Filtr zemí">
            {COUNTRIES.map(({ code, name }) => (
              <label key={code} className="flex gap-2 items-center text-sm">
                <input type="checkbox" checked={countries.includes(code)} onChange={event => setCountries(event.target.checked ? [...countries, code] : countries.filter(country => country !== code))} />
                {code} — {name}
              </label>
            ))}
          </div>
        </details>
        <div role="group" aria-label="Typ služby" className="flex rounded border bg-white overflow-hidden">
          {[['all', 'Vše'], ['balik', 'Balík'], ['paleta', 'Paleta']].map(([value, label]) => (
            <button key={value} aria-pressed={type === value} onClick={() => setType(value)}
              className={`px-3 py-2 ${type === value ? 'bg-blue-100 text-blue-800 font-medium' : 'hover:bg-gray-100'}`}>{label}</button>
          ))}
        </div>
        <label className="text-sm font-medium">Řazení
          <select value={sort} onChange={event => setSort(event.target.value)} className="block mt-1 border rounded bg-white p-2 font-normal">
            <option value="asc">Název A–Z</option><option value="desc">Název Z–A</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-3 justify-between items-center mb-4 text-sm text-gray-600">
        <p role="status">{filteredCarriers.length} dopravců · {filteredCarriers.reduce((count, carrier) => count + carrier.services.length, 0)} odpovídajících služeb</p>
        {hasFilters && <button className="text-blue-700 underline" onClick={resetFilters}>Vymazat filtry</button>}
      </div>
      {filteredCarriers.length === 0 && <div className="border rounded-lg p-8 text-center text-gray-600">
        <p>Žádný dopravce neodpovídá filtrům.</p>
        {!hasFilters && <button className="mt-2 text-blue-700 underline" onClick={resetFilters}>Vymazat filtry</button>}
      </div>}
      <section aria-label="Seznam dopravců" className="space-y-4">
        {filteredCarriers.map(carrier => (
          <article key={carrier.id} className="border rounded-lg bg-white min-w-0" aria-label={carrier.name}>
            <div className="flex items-start gap-3 p-4 border-b">
              <CarrierLogo key={carrier.logo_url || 'no-logo'} carrier={carrier} />
              <div className="flex-1 min-w-0">
                {editingCarrier === `carrier-${carrier.id}` ? (
                  <div className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="text-sm">Název dopravce
                        <input type="text" aria-label="Název dopravce" value={nameDraft} onChange={event => setNameDraft(event.target.value)}
                          onKeyDown={event => { if (event.key === 'Enter') updateCarrier(carrier.id); }} className="block border rounded px-2 py-1 w-full" />
                      </label>
                      <label className="text-sm">URL loga (volitelné)
                        <input type="url" aria-label="URL loga" placeholder="URL loga (volitelné)" value={logoDraft} onChange={event => setLogoDraft(event.target.value)}
                          onKeyDown={event => { if (event.key === 'Enter') updateCarrier(carrier.id); }} className="block border rounded px-2 py-1 w-full" />
                      </label>
                    </div>
                    <fieldset className="min-w-0"><legend className="text-sm mb-2">Podporované země</legend>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {COUNTRIES.map(({ code, name }) => <label key={code} title={name} className="flex gap-1 items-center text-sm">
                          <input type="checkbox" checked={countriesDraft.includes(code)}
                            onChange={event => setCountriesDraft(event.target.checked ? [...countriesDraft, code] : countriesDraft.filter(country => country !== code))} />{code}
                        </label>)}
                      </div>
                    </fieldset>
                    <button aria-label="Uložit dopravce" onClick={() => updateCarrier(carrier.id)} className="rounded bg-blue-600 text-white px-3 py-1">Uložit dopravce</button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold break-words min-w-0">{carrier.name}</h3>
                      <span className={`text-xs rounded px-2 py-1 ${carrier.active ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{carrier.active ? 'Aktivní' : 'Neaktivní'}</span>
                      <button title="Upravit dopravce" onClick={() => {
                        setNameDraft(carrier.name); setLogoDraft(carrier.logo_url || ''); setCountriesDraft([...(carrier.supported_countries || [])]); setEditingCarrier(`carrier-${carrier.id}`);
                      }} className="flex gap-1 items-center text-sm text-blue-700"><EditIcon /> Upravit</button>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Podporované země: {carrier.supported_countries?.join(', ') || 'Žádné'}</p>
                  </>
                )}
              </div>
              <details className="relative shrink-0" onKeyDown={event => { if (event.key === 'Escape') event.currentTarget.removeAttribute('open'); }}>
                <summary aria-label={`Další akce: ${carrier.name}`} className="list-none cursor-pointer px-3 py-1 rounded border text-xl hover:bg-gray-50">⋯</summary>
                <div className="absolute right-0 top-full z-10 w-52 rounded border bg-white shadow-lg p-1">
                  <button onClick={event => { event.currentTarget.closest('details').removeAttribute('open'); setCarrierActive(carrier.id, !carrier.active); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                    {carrier.active ? 'Deaktivovat dopravce' : 'Aktivovat dopravce'}
                  </button>
                  <button title="Smazat dopravce" onClick={event => { event.currentTarget.closest('details').removeAttribute('open'); deleteCarrier(carrier.id); }} className="block w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50">Smazat dopravce</button>
                </div>
              </details>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <colgroup><col className="w-[34%] sm:w-auto" /><col className="w-[25%] sm:w-44" /><col className="w-[25%] sm:w-48" /><col className="w-[16%] sm:w-20" /></colgroup>
                <thead className="bg-gray-50 text-left text-gray-600"><tr>
                  <th scope="col" className="p-2 sm:px-4 font-medium">Název služby</th><th scope="col" className="p-2 font-medium">Typ přepravy</th>
                  <th scope="col" className="p-2 font-medium text-right">Cena za jednotku (Kč)</th><th scope="col" className="p-2 font-medium text-center">Akce</th>
                </tr></thead>
                <tbody>
                  {carrier.services.map(service => (
                    <tr key={service.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 sm:px-4 break-words align-middle">
                        {editingService === `name-${service.id}` ? (
                          <div className="flex items-center gap-2">
                            <input type="text" aria-label="Název služby" value={serviceNameDraft} onChange={event => setServiceNameDraft(event.target.value)}
                              onKeyDown={event => { if (event.key === 'Enter') updateServiceName(service.id); }} className="border rounded px-2 py-1 min-w-0 w-full" />
                            <button aria-label="Uložit název služby" onClick={() => updateServiceName(service.id)} className="text-blue-600"><CheckIcon /></button>
                          </div>
                        ) : service.name}
                      </td>
                      <td className="p-2 align-middle">
                        {editingService === `type-${service.id}` ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <select aria-label="Typ přepravy" value={service.shipment_type} onChange={event => updateService(service.id, { shipment_type: event.target.value })} className="border rounded px-1 py-1 max-w-full">
                              <option value="balik">Balík</option><option value="paleta">Paleta</option>
                            </select>
                            <button aria-label="Zavřít editaci typu" onClick={() => setEditingService(null)} className="text-blue-600"><CheckIcon /></button>
                          </div>
                        ) : <div className="flex flex-wrap items-center gap-2"><span>{service.shipment_type === 'balik' ? 'Balík' : 'Paleta'}</span>
                          <button title="Změnit typ přepravy" onClick={() => setEditingService(`type-${service.id}`)} className="text-gray-500 hover:text-blue-600"><EditIcon /></button>
                        </div>}
                      </td>
                      <td className="p-2 align-middle text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {editingService === service.id ? <>
                            <input type="number" aria-label="Cena služby" value={priceDraft} onChange={event => setPriceDraft(event.target.value)}
                              onKeyDown={event => { if (event.key === 'Enter') updateServicePrice(service.id); }} className="border rounded w-20 max-w-full px-2 py-1 text-right" />
                            <button aria-label="Uložit cenu" onClick={() => updateServicePrice(service.id)} className="text-blue-600"><CheckIcon /></button>
                          </> : <><span className="tabular-nums">{service.price_per_unit}</span>
                            <button title="Upravit cenu" onClick={() => { setPriceDraft(String(service.price_per_unit)); setEditingService(service.id); }} className="text-gray-500 hover:text-blue-600"><EditIcon /></button>
                          </>}
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <button title="Upravit název služby" onClick={() => { setServiceNameDraft(service.name); setEditingService(`name-${service.id}`); }} className="text-gray-500 hover:text-blue-600"><EditIcon /></button>
                      </td>
                    </tr>
                  ))}
                  {!carrier.services.length && <tr><td colSpan={4} className="p-4 text-gray-500">Žádné služby.</td></tr>}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </section>
      </fieldset>
    </div>
  )
}

export default Courier
