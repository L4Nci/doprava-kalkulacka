import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const Products = () => {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchProducts = async () => {
      console.log('Načítám produkty ze Supabase...')
      const { data, error } = await supabase
        .from('products')
        .select('*')

      if (error) {
        console.error('Chyba při načítání produktů:', error)
      } else {
        console.log('Načteno produktů:', data?.length)
        setProducts(data)
      }
      setIsLoading(false)
    }

    fetchProducts()
  }, [])

  if (isLoading) {
    return <p className="text-gray-600">Načítám produkty...</p>
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Produkty</h2>
      
      {products.length === 0 && <p>Žádné produkty nebyly nalezeny.</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product.id} className="border rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow bg-white">
            <img 
              src={product.image_url} 
              alt={product.name} 
              className="h-32 w-full object-contain mb-3"
            />
            <h3 className="text-lg font-semibold text-gray-800">{product.name}</h3>
            <p className="text-sm text-gray-600 mb-2">Kód produktu: {product.code}</p>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Kusů v krabici:</span>
                <span className="font-medium">{product.items_per_box}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Využití palety:</span>
                <span className="font-medium">{(product.palette_percentage * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Products
