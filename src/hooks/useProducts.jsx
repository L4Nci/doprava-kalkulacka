import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useProducts() {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchProducts()

    // Realtime subscription
    const channel = supabase
      .channel('products_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'products' 
        },
        async (payload) => {
          console.log('Realtime update received:', payload);
          // Při jakékoliv změně načteme znovu všechna data
          await fetchProducts();
        }
      )
      .subscribe(status => {
        console.log('Realtime subscription status:', status);
      })

    return () => {
      console.log('Cleaning up subscription');
      channel.unsubscribe();
    }
  }, [])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')

      if (error) throw error

      console.log('Fetched products:', data?.length);
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return { products, isLoading, error, refetch: fetchProducts }
}
