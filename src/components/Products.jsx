import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const Products = () => {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingProduct, setEditingProduct] = useState(null)

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

  const updateProduct = async (productId, updates) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId)

      if (error) throw error

      setProducts(products.map(p => 
        p.id === productId ? { ...p, ...updates } : p
      ))
    } catch (err) {
      console.error('Chyba při ukládání:', err)
    }
  }

  if (isLoading) {
    return <p className="text-gray-600">Načítám produkty...</p>
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Produkty</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product.id} className="border rounded-lg p-4 shadow-md bg-white">
            <img src={product.image_url} alt={product.name} className="h-32 w-full object-contain mb-3" />
            <h3 className="text-lg font-semibold">{product.name}</h3>
            
            {editingProduct === product.id ? (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Kusů v krabici:</span>
                  <input
                    type="number"
                    value={product.items_per_box}
                    onChange={(e) => {
                      const value = parseInt(e.target.value)
                      if (!isNaN(value)) {
                        updateProduct(product.id, { items_per_box: value })
                      }
                    }}
                    className="border rounded w-20 px-2 py-1 text-right"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Využití palety (%):</span>
                  <input
                    type="number"
                    value={product.palette_percentage * 100}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value)
                      if (!isNaN(value)) {
                        updateProduct(product.id, { palette_percentage: value / 100 })
                      }
                    }}
                    className="border rounded w-20 px-2 py-1 text-right"
                    step="0.1"
                  />
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => setEditingProduct(null)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Hotovo
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Kusů v krabici: {product.items_per_box}</span>
                  <button
                    onClick={() => setEditingProduct(product.id)}
                    className="text-gray-400 hover:text-blue-600"
                    title="Upravit hodnoty"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-gray-600">Využití palety: {(product.palette_percentage * 100).toFixed(1)}%</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Products
