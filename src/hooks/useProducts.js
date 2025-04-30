import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useProducts() {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const isMounted = useRef(true)
  const fetchInProgress = useRef(false)

  const fetchProducts = useCallback(async () => {
    if (fetchInProgress.current) {
      console.debug('🔄 Fetch already in progress, skipping...');
      return;
    }

    fetchInProgress.current = true;
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')

      if (error) throw error
      if (!isMounted.current) return;

      console.debug('📦 Products loaded:', {
        count: data?.length,
        timestamp: new Date().toISOString()
      });
      
      setProducts(data || [])
      setError(null)
    } catch (error) {
      console.error('❌ Error:', error)
      if (isMounted.current) {
        setError(error.message)
      }
    } finally {
      fetchInProgress.current = false;
      if (isMounted.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let timeoutId;
    console.debug('🎯 Initializing products subscription');

    const channel = supabase
      .channel('products_updates')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.debug('📡 Products update:', payload.eventType);
          // Debounce updates
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            if (isMounted.current) {
              fetchProducts();
            }
          }, 100);
        }
      )
      .subscribe((status) => {
        console.debug('📶 Subscription status:', status);
      });

    fetchProducts();

    return () => {
      console.debug('🧹 Cleaning up products subscription');
      clearTimeout(timeoutId);
      isMounted.current = false;
      channel.unsubscribe();
    }
  }, [fetchProducts]);

  return {
    products,
    isLoading,
    error,
    refetch: fetchProducts
  }
}
