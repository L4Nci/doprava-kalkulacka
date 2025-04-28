import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { productPackaging as staticProducts } from '../config/packaging'

export function useProducts() {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchProducts = async () => {
      console.log('Načítám produkty ze Supabase...');
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name');

        console.log('Načtená data z products:', data) // přidáme log pro kontrolu

        if (error) throw error

        if (data && data.length > 0) {
          console.log('Data před transformací:', data);
          
          setProducts(data.map(product => ({
            ...product,
            parcel_disabled: product.parcel_disabled || false,
            multiple_boxes: product.multiple_boxes || false,
            boxes_per_item: product.boxes_per_item || 1
          })));
          
          console.log('Data po transformaci:', products);
        } else {
          console.log('Supabase je prázdná, používám lokální data produktů');
          setProducts(staticProducts)
        }
      } catch (err) {
        console.error('Chyba při načítání ze Supabase:', err)
        console.log('Přepínám na lokální data produktů');
        setError(err)
        setProducts(staticProducts)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProducts()
  }, [])

  return {
    products,
    isLoading,
    error
  }
}
