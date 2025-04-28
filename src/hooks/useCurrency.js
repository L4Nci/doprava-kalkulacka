import { useState, useEffect } from 'react'
import { countryCurrencies } from '../config/currencies'

export function useCurrency() {
  const [rates, setRates] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/CZK')
        const data = await response.json()
        setRates(data.rates)
        setIsLoading(false)
      } catch (err) {
        console.error('Chyba při načítání kurzů:', err)
        setError(err)
        setIsLoading(false)
      }
    }

    fetchRates()
    // Aktualizace kurzů každou hodinu
    const interval = setInterval(fetchRates, 3600000)
    return () => clearInterval(interval)
  }, [])

  const formatCurrency = (value, currencyCode) => {
    switch (currencyCode) {
      case 'HUF':
        return Math.round(value); // Forinty se zobrazují bez desetinných míst
      case 'PLN':
        return value.toFixed(2); // Zloté na 2 desetinná místa
      case 'EUR':
        return value.toFixed(2); // Eura na 2 desetinná místa
      default:
        return value.toFixed(2);
    }
  }

  const convertPrice = (priceInCZK, targetCountry) => {
    if (!rates || !targetCountry) return { value: priceInCZK, symbol: 'Kč' }

    const currency = countryCurrencies[targetCountry]
    if (!currency || currency.code === 'CZK') {
      return { value: priceInCZK, symbol: 'Kč' }
    }

    const rate = rates[currency.code]
    if (!rate) return { value: priceInCZK, symbol: 'Kč' }

    const convertedValue = priceInCZK * rate
    return {
      value: formatCurrency(convertedValue, currency.code),
      symbol: currency.symbol,
      code: currency.code,
      isLoading,
      error
    }
  }

  return { convertPrice, isLoading, error }
}
