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

        if (error) throw error

        if (data && data.length > 0) {
          console.log('Úspěšně načteno ze Supabase:', {
            početProduktů: data.length,
            produkty: data.map(p => p.name)
          });

          const formattedProducts = data.reduce((acc, product) => {
            acc[product.code] = {
              itemsPerBox: product.items_per_box,
              palettePercentage: product.palette_percentage,
              imageUrl: product.image_url,
              name: product.name
            }
            return acc
          }, {})
          setProducts(formattedProducts)
          console.log('Data produktů transformována a připravena k použití');
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

  return { products, isLoading, error }
}
