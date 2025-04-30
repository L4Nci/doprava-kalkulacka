import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useProducts() {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [syncStatus, setSyncStatus] = useState({
    lastSync: null,
    isSubscribed: false,
    connectionStatus: 'disconnected'
  })

  const fetchProducts = useCallback(async (force = false) => {
    console.log('Fetching products...', { force });
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name')

      if (error) throw error

      setProducts(data || [])
      setSyncStatus(prev => ({
        ...prev,
        lastSync: new Date().toISOString()
      }))
      setError(null)
    } catch (error) {
      console.error('Error fetching products:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    console.log('Setting up realtime subscription...');
    
    const channel = supabase
      .channel('products_realtime')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        async (payload) => {
          console.log('Realtime update:', payload);
          await fetchProducts(true);
          setSyncStatus(prev => ({
            ...prev,
            lastSync: new Date().toISOString()
          }));
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        setSyncStatus(prev => ({
          ...prev,
          isSubscribed: status === 'SUBSCRIBED',
          connectionStatus: status
        }));
      });

    // Initial fetch
    fetchProducts(true);

    // Polling fallback
    const pollInterval = setInterval(() => {
      if (!syncStatus.isSubscribed) {
        console.log('Polling for updates...');
        fetchProducts(true);
      }
    }, 30000);

    return () => {
      console.log('Cleaning up subscription...');
      channel.unsubscribe();
      clearInterval(pollInterval);
      setSyncStatus(prev => ({
        ...prev,
        isSubscribed: false,
        connectionStatus: 'disconnected'
      }));
    };
  }, [fetchProducts]);

  return {
    products,
    isLoading,
    error,
    syncStatus,
    refetch: () => fetchProducts(true)
  };
}
