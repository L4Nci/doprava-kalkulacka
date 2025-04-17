import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { carriers as staticCarriers } from '../config/carriers'
import { useProducts } from '../hooks/useProducts'
import { useCurrency } from '../hooks/useCurrency'

function MainApp() {
  const [carriers, setCarriers] = useState([])
  const [selectedItems, setSelectedItems] = useState([])
  const [selectedCountry, setSelectedCountry] = useState('')
  const [parcelTotal, setParcelTotal] = useState(null)
  const [palletTotal, setPalletTotal] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copySuccess, setCopySuccess] = useState({ parcel: false, pallet: false })
  const [availableCountries, setAvailableCountries] = useState([])
  const [error, setError] = useState(null)

  const [productType, setProductType] = useState('')
  const [quantity, setQuantity] = useState('')

  const { products, isLoading: productsLoading } = useProducts()
  const { convertPrice, isLoading: currencyLoading } = useCurrency()

  const predefinedProducts = products.reduce((acc, product) => {
    if (!product || !product.code) {
      console.warn('Nalezen neplatný produkt:', product);
      return acc;
    }

    acc[product.code] = {
      boxesPerUnit: 1 / product.items_per_box,
      itemsPerPallet: product.items_per_pallet,
      name: product.name,
      image: product.image_url,
      parcelDisabled: Boolean(product.parcel_disabled)
    }
    return acc
  }, {})

  // Přidáme debug log
  console.log('Načtené produkty:', products);
  console.log('Zpracované produkty:', predefinedProducts);

  const countryNames = {
    CZ: "Česko",
    SK: "Slovensko",
    HR: "Chorvatsko",
    DE: "Německo",
    HU: "Maďarsko",
    PL: "Polsko",
    SI: "Slovinsko"
  };

  useEffect(() => {
    const fetchCarriers = async () => {
      console.log('Načítám data ze Supabase...');
      try {
        const { data, error } = await supabase
          .from('carriers')
          .select(`
            *,
            services (
              *
            )
          `)

        if (error) throw error;

        console.log('Načtená data:', {
          početDopravců: data?.length || 0,
          dopravci: data?.map(d => d.name),
          services: data?.map(d => d.services?.length || 0)
        });

        if (!data || data.length === 0) {
          console.log('Supabase je prázdná, používám záložní data');
          setCarriers(Object.values(staticCarriers));
        } else {
          console.log('Používám data ze Supabase');
          setCarriers(data);

          const countries = new Set();
          data.forEach(carrier => {
            carrier.supported_countries?.forEach(country => {
              countries.add(country);
            });
          });
          const sortedCountries = Array.from(countries).sort((a, b) =>
            countryNames[a]?.localeCompare(countryNames[b] || a)
          );
          setAvailableCountries(sortedCountries);
          console.log('Dostupné země:', sortedCountries);
        }
      } catch (error) {
        console.error('Chyba:', error.message);
        setCarriers(Object.values(staticCarriers));
      }
    }

    fetchCarriers();
  }, [])

  const addItem = () => {
    if (!productType || !quantity) return
    
    console.log('Přidávám produkt:', { productType, quantity });
    
    const product = predefinedProducts[productType]
    if (!product) {
      console.error('Produkt nenalezen:', productType);
      return;
    }

    const qty = parseInt(quantity)
    
    console.log('Přidávám produkt:', {
      productType,
      product,
      qty
    })

    // Přidáme kontrolu, že máme všechna potřebná data
    if (!product || !product.itemsPerPallet) {
      console.error('Chybí údaj o kapacitě palety nebo produkt:', product)
      return
    }

    const boxes = Math.ceil(product.boxesPerUnit * qty)
    const palletUsagePercentage = (qty / product.itemsPerPallet) * 100
    const requiredPallets = Math.ceil(palletUsagePercentage / 100)

    const newItem = { 
      productType, 
      quantity: qty, 
      boxes,
      pallets: requiredPallets,
      palletUsagePercentage,
      ...product 
    }
    
    setSelectedItems([...selectedItems, newItem])
    setProductType('')
    setQuantity('')
  }

  const removeItem = (index) => {
    setSelectedItems(prevItems => prevItems.filter((_, i) => i !== index));
  };

  const validateAndCalculate = () => {
    setError(null)

    if (selectedItems.length === 0) {
      setError('Přidejte alespoň jednu položku')
      return false
    }

    if (!selectedCountry) {
      setError('Vyberte cílovou zemi')
      return false
    }

    // Check if there are any pallet-only products
    const hasPalletOnlyItems = selectedItems.some(item => item.parcelDisabled);

    // Only show 1000+ boxes warning if there are no pallet-only products
    if (!hasPalletOnlyItems) {
      const totalBoxes = Math.ceil(selectedItems.reduce((sum, item) => sum + item.boxes, 0))
      if (totalBoxes > 1000) {
        if (!window.confirm('Opravdu chcete vypočítat dopravu pro více než 1000 krabic?')) {
          return false
        }
      }
    }

    return true
  }

  const calculateShipping = async () => {
    if (!validateAndCalculate()) return;
    
    setIsLoading(true)
    try {
      const hasParcelDisabledItems = selectedItems.some(item => item.parcelDisabled);
      const totalBoxes = hasParcelDisabledItems ? 0 : Math.ceil(selectedItems.reduce((sum, item) => sum + item.boxes, 0));
      const totalPallets = Math.ceil(
        selectedItems.reduce((sum, item) => sum + item.palletUsagePercentage, 0) / 100
      );

      const country = selectedCountry;
      let parcelOption = null;
      let palletOption = null;

      const carriersToUse = carriers.length > 0 ? carriers : Object.values(staticCarriers);

      carriersToUse.forEach(carrier => {
        const supportedCountries = carrier.supported_countries || carrier.supportedCountries;
        if (!supportedCountries?.includes(country)) return;

        const services = carrier.services || [];
        services.forEach(service => {
          const shipmentType = service.shipment_type || service.shipmentType;
          
          // Přeskočíme balíkovou přepravu pokud máme zakázané položky
          if (hasParcelDisabledItems && shipmentType === 'balik') return;
          
          const pricePerUnit = service.price_per_unit || service.pricePerUnit;
          const price = pricePerUnit * (shipmentType === 'balik' ? totalBoxes : totalPallets);
          
          if (shipmentType === 'balik' && !hasParcelDisabledItems) {
            if (!parcelOption || price < parcelOption.price) {
              parcelOption = { carrier: carrier.name, price, logo: carrier.logo_url || carrier.logoUrl, service: service.name };
            }
          }
          if (shipmentType === 'paleta') {
            if (!palletOption || price < palletOption.price) {
              palletOption = { carrier: carrier.name, price, logo: carrier.logo_url || carrier.logoUrl, service: service.name };
            }
          }
        });
      });

      setParcelTotal(hasParcelDisabledItems ? null : parcelOption);
      setPalletTotal(palletOption);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedItems([])
    setParcelTotal(null)
    setPalletTotal(null)
    setSelectedCountry('')
  }

  const copyToClipboard = async (price, type) => {
    try {
      await navigator.clipboard.writeText(price.toString());
      setCopySuccess(prev => ({ ...prev, [type]: true }));
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [type]: false }));
      }, 2000);
    } catch (err) {
      console.error('Kopírování selhalo:', err);
    }
  };

  const renderPrice = (priceInCZK) => {
    const localPrice = convertPrice(priceInCZK, selectedCountry)
    if (localPrice.symbol === 'Kč' || currencyLoading) {
      return `${priceInCZK.toLocaleString('cs-CZ')} Kč`
    }

    let formattedLocalPrice
    switch (localPrice.code) {
      case 'HUF':
        formattedLocalPrice = `${parseInt(localPrice.value).toLocaleString('hu-HU')} ${localPrice.symbol}`
        break
      case 'PLN':
        formattedLocalPrice = `${parseFloat(localPrice.value).toLocaleString('pl-PL')} ${localPrice.symbol}`
        break
      case 'EUR':
        formattedLocalPrice = `${parseFloat(localPrice.value).toLocaleString('de-DE')} ${localPrice.symbol}`
        break
      default:
        formattedLocalPrice = `${localPrice.value} ${localPrice.symbol}`
    }

    return (
      <span>
        {priceInCZK.toLocaleString('cs-CZ')} Kč
        <span className="text-gray-500 ml-1">
          ({formattedLocalPrice})
        </span>
      </span>
    )
  }

  const totalBoxes = selectedItems.some(item => item.parcelDisabled) 
    ? "Není k dispozici (pouze paletová přeprava)" 
    : Math.ceil(selectedItems.reduce((sum, item) => sum + item.boxes, 0));
  const totalPallets = Math.ceil(
    selectedItems.reduce((sum, item) => sum + item.palletUsagePercentage, 0) / 100
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-center text-3xl font-bold text-blue-700 mb-1">Doprava 3.0</h1>
      <p className="text-center mb-6 text-gray-600">Vypočítej ideální způsob doručení</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {/* Vstup */}
        <div className="bg-white p-6 rounded shadow">
          <label className="block font-medium mb-1">Vyberte typ produktu:</label>
          <select
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            className="border p-2 w-full mb-2 rounded"
          >
            <option value="">Vyberte produkt...</option>
            {products.map((product) => (
              <option key={product.code} value={product.code}>
                {product.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Kolik kusů posíláš?"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="border p-2 w-full mb-4 rounded"
          />
          <button onClick={addItem} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 w-full rounded">
            Přidat
          </button>
        </div>

        {/* Seznam položek */}
        <div className="bg-white p-6 rounded shadow">
          <h3 className="font-bold text-lg mb-4">Seznam položek</h3>
          {selectedItems.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between mb-3 group">
              <div className="flex items-center space-x-2">
                <img src={item.image} alt={item.productType} className="h-10 w-auto" />
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-gray-600">Počet kusů: {item.quantity}</p>
                  <p className="text-sm text-gray-600">Počet krabic: {Math.ceil(item.boxes)}</p>
                  <p className="text-sm text-gray-600">
                    Obsazenost palety: {!isNaN(item.palletUsagePercentage) ? `${item.palletUsagePercentage.toFixed(0)}%` : '0%'}
                    {' '}
                    ({!isNaN(item.pallets) ? item.pallets : 0} {item.pallets === 1 ? 'paleta' : item.pallets >= 2 && item.pallets <= 4 ? 'palety' : 'palet'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeItem(idx)}
                className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Odstranit položku"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l4.293 4.293a1 1 0 01-1.414 1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}

          {selectedItems.length > 0 && (
            <div className="bg-gray-100 p-3 rounded text-sm mt-2">
              <p><strong>Celkový přehled:</strong></p>
              <p>Celkem krabic: {typeof totalBoxes === 'number' ? totalBoxes : totalBoxes}</p>
              <p>Celkem palet: {Math.ceil(totalPallets)}</p>
              {selectedItems.some(item => item.parcelDisabled) && (
                <p className="text-orange-600 mt-1">⚠️ Některé produkty lze přepravovat pouze na paletách</p>
              )}
            </div>
          )}

          <div className="mt-4">
            <label className="block mb-1">Vyberte cílovou zemi:</label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="border p-2 w-full rounded"
            >
              <option value="">Vyberte zemi...</option>
              {availableCountries.map(countryCode => (
                <option key={countryCode} value={countryCode}>
                  {countryNames[countryCode] || countryCode}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-red-600 text-sm mb-2">{error}</div>
          )}

          <div className="flex space-x-2 mt-4">
            <button
              onClick={calculateShipping}
              disabled={isLoading}
              className={`bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 w-full rounded ${
                isLoading ? 'opacity-50' : ''
              }`}
            >
              {isLoading ? 'Počítám...' : 'Spočítat'}
            </button>
            <button
              onClick={resetForm}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 w-full rounded"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Výsledek */}
        <div className="bg-white p-6 rounded shadow">
          <h3 className="font-bold text-lg mb-4">Doporučený dopravce</h3>
          
          <div className="mb-6">
            <p className="text-sm font-medium">Balíková přeprava:</p>
            {parcelTotal ? (
              <div className={`border rounded p-3 mt-1 ${
                palletTotal && parcelTotal.price < palletTotal.price ? 'bg-green-100' : ''
              }`}>
                <p className="font-semibold">Doporučená varianta:</p>
                <img src={parcelTotal.logo} alt="Logo" className="h-6 my-1" />
                <p>{parcelTotal.carrier} - {parcelTotal.service}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-gray-500">
                    Celková cena: {renderPrice(parcelTotal.price)}
                  </p>
                  <button
                    onClick={() => copyToClipboard(parcelTotal.price, 'parcel')}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Kopírovat cenu"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>
                  {copySuccess.parcel && <span className="text-xs text-green-600">Zkopírováno!</span>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Nenalezeno</p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium">Paletová přeprava:</p>
            {palletTotal ? (
              <div className={`border rounded p-3 mt-1 ${
                parcelTotal && palletTotal.price < parcelTotal.price ? 'bg-green-100' : ''
              }`}>
                <p className={`font-semibold ${
                  parcelTotal && palletTotal.price < parcelTotal.price ? 'text-green-700' : 'text-gray-700'
                }`}>
                  {parcelTotal && palletTotal.price < parcelTotal.price ? 'Nejvýhodnější varianta:' : 'Paletová varianta:'}
                </p>
                <img src={palletTotal.logo} alt="Logo" className="h-6 my-1" />
                <p>{palletTotal.carrier} - {palletTotal.service}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-gray-600">
                    Celková cena: {renderPrice(palletTotal.price)}
                  </p>
                  <button
                    onClick={() => copyToClipboard(palletTotal.price, 'pallet')}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Kopírovat cenu"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>
                  {copySuccess.pallet && <span className="text-xs text-green-600">Zkopírováno!</span>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Nenalezeno</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MainApp
