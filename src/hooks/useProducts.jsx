import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useProducts() {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const CACHE_VALIDITY = 1000 * 60 * 60 // 1 hodina

    const fetchProducts = async () => {
      try {
        const cached = localStorage.getItem('products')
        const cacheTimestamp = localStorage.getItem('products_timestamp')
        const now = Date.now()

        // 1. Nejdřív se zobrazí cached data pro rychlost
        if (cached && cacheTimestamp && (now - parseInt(cacheTimestamp)) < CACHE_VALIDITY) {
          setProducts(JSON.parse(cached))
          // 2. Okamžitě se spustí background refresh
          refreshDataInBackground()
          return
        }

        // Pokud jsme offline a máme cache, použijeme ji
        if (!navigator.onLine && cached) {
          console.log('Offline mode - using cached data')
          setProducts(JSON.parse(cached))
          return
        }

        // 2. Fetch ze Supabase když cache není platná
        await fetchFromSupabase()

      } catch (error) {
        console.error('Error fetching products:', error)
        setError(error.message)
        
        // Při chybě se pokusíme použít cache
        const cached = localStorage.getItem('products')
        if (cached) {
          setProducts(JSON.parse(cached))
        }
      } finally {
        setIsLoading(false)
      }
    }

    const fetchFromSupabase = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')

      if (!error && data) {
        setProducts(data)
        localStorage.setItem('products', JSON.stringify(data))
        localStorage.setItem('products_timestamp', Date.now().toString())
      } else {
        throw error
      }
    }

    const refreshDataInBackground = async () => {
      // Získá čerstvá data ze Supabase
      const { data: freshData } = await supabase.from('products').select('*')
      if (freshData) {
        setProducts(freshData)
        localStorage.setItem('products', JSON.stringify(freshData))
        localStorage.setItem('products_timestamp', Date.now().toString())
      }
    }

    fetchProducts()
  }, [])

  return { products, isLoading, error }
}
