import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useProducts() {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name')

        if (error) throw error
        setProducts(data || [])
      } catch (error) {
        console.error('Error fetching products:', error)
        setError(error.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProducts()
  }, [])

  return { products, isLoading, error }
}
