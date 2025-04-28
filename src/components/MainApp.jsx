import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { carriers as staticCarriers } from '../config/carriers'
import { useProducts } from '../hooks/useProducts.jsx'
import { useCurrency } from '../hooks/useCurrency'
import { PriceNotification } from './PriceNotification'

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
  const [inputError, setInputError] = useState(null)

  const [productType, setProductType] = useState('')
  const [quantity, setQuantity] = useState('')

  const { products } = useProducts()
  const { convertPrice, isLoading: currencyLoading } = useCurrency()

  const predefinedProducts = products.reduce((acc, product) => {
    if (!product || !product.code) {
      console.warn('Nalezen neplatný produkt:', product);
      return acc;
    }

    acc[product.code] = {
      boxesPerUnit: product.parcel_disabled ? null : (product.items_per_box ? 1 / product.items_per_box : null),
      itemsPerPallet: product.pallet_disabled ? null : product.items_per_pallet,
      name: product.name,
      image: product.image_url,
      parcelDisabled: Boolean(product.parcel_disabled),
      palletDisabled: Boolean(product.pallet_disabled)
    }
    return acc
  }, {})

  // Přidáme debug log
  console.log('Načtené produkty:', products);
  console.log('Zpracované produkty:', predefinedProducts);

  const countryNames = useMemo(() => ({
    CZ: "Česko",
    SK: "Slovensko",
    HR: "Chorvatsko",
    DE: "Německo",
    HU: "Maďarsko",
    PL: "Polsko",
    SI: "Slovinsko"
  }), []);

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
  }, [countryNames])

  const handleQuantityChange = (e) => {
    const value = e.target.value
    if (value < 0) {
      setInputError('Počet kusů nemůže být záporný')
      setQuantity('')
      return
    }
    setInputError(null)
    setQuantity(value)
  }

  const handleAddItem = () => {
    console.log('Přidávám položku:', { productType, quantity });
    
    if (!productType || !quantity) {
      console.log('Chybí produkt nebo množství');
      setError('Vyberte produkt a zadejte počet kusů');
      return;
    }
  
    const selectedProduct = products.find(p => p.code === productType);
    
    if (!selectedProduct) {
      console.log('Produkt nebyl nalezen');
      setError('Produkt nebyl nalezen');
      return;
    }
  
    const boxes = selectedProduct.parcel_disabled 
      ? null 
      : (selectedProduct.multiple_boxes 
        ? selectedProduct.boxes_per_item * parseInt(quantity) 
        : Math.ceil(selectedProduct.items_per_box ? 1/selectedProduct.items_per_box * parseInt(quantity) : 0));
        
    const palletUsagePercentage = selectedProduct.pallet_disabled 
      ? 0 
      : (selectedProduct.items_per_pallet 
        ? (parseInt(quantity) / selectedProduct.items_per_pallet) * 100 
        : 0);
  
    setSelectedItems(prevItems => [
      ...prevItems,
      {
        id: Date.now(),
        name: selectedProduct.name,
        quantity: parseInt(quantity),
        boxes,
        palletUsagePercentage,
        image: selectedProduct.image_url,
        parcelDisabled: selectedProduct.parcel_disabled,
        palletDisabled: selectedProduct.pallet_disabled
      }
    ]);
  
    // Reset formuláře
    setProductType('');
    setQuantity('');
    setError(null);
  };

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

    return true
  }

  const calculateShipping = async () => {
    if (!validateAndCalculate()) return;
    
    setIsLoading(true)
    try {
      const hasParcelDisabledItems = selectedItems.some(item => item.parcelDisabled);
      const hasPalletDisabledItems = selectedItems.some(item => item.palletDisabled);
      
      // Počítáme balíky pouze pokud nemáme zakázané položky pro balíky
      const totalBoxes = hasParcelDisabledItems ? null : Math.ceil(
        selectedItems
          .filter(item => !item.parcelDisabled)
          .reduce((sum, item) => sum + item.boxes, 0)
      );

      // Počítáme palety pouze pokud nemáme zakázané položky pro palety
      const totalPallets = hasPalletDisabledItems ? null : Math.ceil(
        selectedItems
          .filter(item => !item.palletDisabled)
          .reduce((sum, item) => sum + item.palletUsagePercentage, 0) / 100
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
          
          // Skip parcel options if parcel shipping is disabled
          if (hasParcelDisabledItems && shipmentType === 'balik') return;
          
          // Skip pallet options if pallet shipping is disabled
          if (hasPalletDisabledItems && shipmentType === 'paleta') return;

          const pricePerUnit = service.price_per_unit || service.pricePerUnit;
          const price = pricePerUnit * (shipmentType === 'balik' ? totalBoxes : totalPallets);
          
          if (shipmentType === 'balik' && !hasParcelDisabledItems) {
            if (!parcelOption || price < parcelOption.price) {
              parcelOption = { carrier: carrier.name, price, logo: carrier.logo_url || carrier.logoUrl, service: service.name };
            }
          }
          
          if (shipmentType === 'paleta' && !hasPalletDisabledItems) {
            if (!palletOption || price < palletOption.price) {
              palletOption = { carrier: carrier.name, price, logo: carrier.logo_url || carrier.logoUrl, service: service.name };
            }
          }
        });
      });

      setParcelTotal(hasParcelDisabledItems ? null : parcelOption);
      setPalletTotal(hasPalletDisabledItems ? null : palletOption);
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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-6 transition-colors duration-200">
      <PriceNotification />
      <div className="max-w-6xl mx-auto relative">
        <h1 className="text-center text-3xl font-bold text-blue-700 dark:text-blue-400 mb-1">Doprava 3.0</h1>
        <p className="text-center mb-6 text-gray-600 dark:text-gray-400">Vypočítej ideální způsob doručení</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Vstup */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow">
            <label className="block font-medium mb-1 dark:text-white">Vyberte typ produktu:</label>
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
              min="0"
              placeholder="Kolik kusů posíláš?"
              value={quantity}
              onChange={handleQuantityChange}
              className={`border p-2 w-full mb-1 rounded ${inputError ? 'border-red-500' : ''}`}
            />
            {inputError && (
              <p className="text-red-500 text-sm mb-3">{inputError}</p>
            )}
            <button onClick={handleAddItem} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 w-full rounded">
              Přidat
            </button>
          </div>

          {/* Seznam položek */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow">
            <h3 className="font-bold text-lg mb-4 dark:text-white">Seznam položek</h3>
            {selectedItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between mb-3 group">
                <div className="flex items-center space-x-2">
                  <img src={item.image} alt={item.productType} className="h-10 w-auto" />
                  <div>
                    <p className="font-medium dark:text-white">{item.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Počet kusů: {item.quantity}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {item.parcelDisabled 
                        ? "Nelze odeslat na balíky"
                        : `Počet krabic: ${Math.ceil(item.boxes)}`
                      }
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {item.palletDisabled
                        ? "Nelze odeslat na paletě"
                        : `Obsazenost palety: ${item.palletUsagePercentage.toFixed(0)}% (${item.pallets} ${
                            item.pallets === 1 ? 'paleta' : item.pallets >= 2 && item.pallets <= 4 ? 'palety' : 'palet'
                          })`
                      }
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
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm mt-2">
                <p className="dark:text-white"><strong>Celkový přehled:</strong></p>
                <p className="dark:text-white">Celkem krabic: {typeof totalBoxes === 'number' ? totalBoxes : 'Není k dispozici'}</p>
                <p className="dark:text-white">Celkem palet: {Math.ceil(totalPallets)}</p>
              </div>
            )}

            <div className="mt-4">
              <label className="block mb-1 dark:text-white">Vyberte cílovou zemi:</label>
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
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow">
            <h3 className="font-bold text-lg mb-4 dark:text-white">Doporučený dopravce</h3>
            
            <div className="mb-6">
              <p className="text-sm font-medium dark:text-white">Balíková přeprava:</p>
              {parcelTotal ? (
                <div className={`border rounded p-3 mt-1 ${
                  palletTotal && parcelTotal.price < palletTotal.price ? 'bg-green-100 dark:bg-green-700' : ''
                }`}>
                  <p className="font-semibold dark:text-white">Doporučená varianta:</p>
                  <img src={parcelTotal.logo} alt="Logo" className="h-6 my-1" />
                  <p className="dark:text-white">{parcelTotal.carrier} - {parcelTotal.service}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-gray-500 dark:text-gray-300">
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
                <>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Nenalezeno</p>
                  {selectedItems.some(item => item.parcelDisabled) && (
                    <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">⚠️ Některé produkty lze přepravovat pouze na paletách</p>
                  )}
                </>
              )}
            </div>

            <div>
              <p className="text-sm font-medium dark:text-white">Paletová přeprava:</p>
              {palletTotal ? (
                <div className={`border rounded p-3 mt-1 ${
                  parcelTotal && palletTotal.price < parcelTotal.price ? 'bg-green-100 dark:bg-green-700' : ''
                }`}>
                  <p className={`font-semibold ${
                    parcelTotal && palletTotal.price < parcelTotal.price ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {parcelTotal && palletTotal.price < parcelTotal.price ? 'Nejvýhodnější varianta:' : 'Paletová varianta:'}
                  </p>
                  <img src={palletTotal.logo} alt="Logo" className="h-6 my-1" />
                  <p className="dark:text-white">{palletTotal.carrier} - {palletTotal.service}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
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
                <>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Nenalezeno</p>
                  {selectedItems.some(item => item.palletDisabled) && (
                    <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">⚠️ Některé produkty nelze přepravovat na paletách</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MainApp
