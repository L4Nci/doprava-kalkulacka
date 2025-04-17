import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const Products = () => {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingProduct, setEditingProduct] = useState(null)
  const [showNewProductForm, setShowNewProductForm] = useState(false)
  const [newProduct, setNewProduct] = useState({
    name: '',
    items_per_box: 0,
    palette_percentage: 0.01,
    image_url: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const generateCodeFromName = (name) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // odstranění diakritiky
      .replace(/[^a-z0-9]+/g, '-') // nahrazení mezer a spec. znaků pomlčkou
      .replace(/^-+|-+$/g, ''); // odstranění pomlček na začátku a konci
  }

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

  const addNewProduct = async () => {
    if (isSubmitting) return; // Prevent double submission
    
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const { data, error } = await supabase
        .from('products')
        .insert([{
          name: newProduct.name.trim(),
          code: generateCodeFromName(newProduct.name), // generujeme code z názvu
          items_per_box: parseInt(newProduct.items_per_box),
          palette_percentage: parseFloat(newProduct.palette_percentage) / 100,
          image_url: newProduct.image_url.trim()
        }])
        .select()

      if (error) throw error

      console.log('Produkt úspěšně vytvořen:', data)
      setProducts([...products, data[0]])
      setShowNewProductForm(false)
    } catch (err) {
      console.error('Chyba při vytváření produktu:', err)
      setSubmitError(err.message || 'Nepodařilo se vytvořit produkt')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteProduct = async (productId) => {
    setDeletingProduct(productId);
    setDeleteConfirmation('');
  };

  const confirmDelete = async () => {
    if (deleteConfirmation.toLowerCase() !== 'smazat') return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deletingProduct);

      if (error) throw error;

      setProducts(products.filter(p => p.id !== deletingProduct));
      setDeletingProduct(null);
      setDeleteConfirmation('');
    } catch (err) {
      console.error('Chyba při mazání produktu:', err);
    }
  };

  if (isLoading) {
    return <p className="text-gray-600">Načítám produkty...</p>
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Produkty</h2>
        <button
          onClick={() => setShowNewProductForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Přidat produkt
        </button>
      </div>

      {showNewProductForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Nový produkt</h3>
            
            {submitError && (
              <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                {submitError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block mb-1">Název produktu</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="border p-2 w-full rounded"
                  placeholder="např. Polštář"
                />
              </div>

              <div>
                <label className="block mb-1">URL obrázku</label>
                <input
                  type="text"
                  value={newProduct.image_url}
                  onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })}
                  className="border p-2 w-full rounded"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block mb-1">Kusů v krabici</label>
                <input
                  type="number"
                  value={newProduct.items_per_box}
                  onChange={(e) => setNewProduct({ ...newProduct, items_per_box: e.target.value })}
                  className="border p-2 w-full rounded"
                  min="1"
                />
              </div>

              <div>
                <label className="block mb-1">Využití palety (%)</label>
                <input
                  type="number"
                  value={newProduct.palette_percentage}
                  onChange={(e) => setNewProduct({ ...newProduct, palette_percentage: e.target.value })}
                  className="border p-2 w-full rounded"
                  step="0.1"
                  min="0.1"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowNewProductForm(false)
                  setSubmitError(null)
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={isSubmitting}
              >
                Zrušit
              </button>
              <button
                onClick={addNewProduct}
                disabled={isSubmitting}
                className={`bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 ${
                  isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? 'Vytvářím...' : 'Vytvořit produkt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Potvrzení smazání</h3>
            <p className="mb-4">Pro smazání produktu napište "smazat"</p>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="border p-2 w-full rounded mb-4"
              placeholder="smazat"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDeletingProduct(null);
                  setDeleteConfirmation('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Zrušit
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmation.toLowerCase() !== 'smazat'}
                className={`bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 
                  ${deleteConfirmation.toLowerCase() !== 'smazat' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Smazat produkt
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product.id} className="border rounded-lg p-4 shadow-md bg-white">
            <div className="flex justify-between items-start mb-4">
              <div className="w-full">
                <img 
                  src={product.image_url} 
                  alt={product.name} 
                  className="h-32 w-full object-contain" 
                />
                <h3 className="text-lg font-semibold mt-2">{product.name}</h3>
              </div>
              <button
                onClick={() => deleteProduct(product.id)}
                className="text-red-500 hover:text-red-700 p-1"
                title="Smazat produkt"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <div className="border rounded overflow-hidden">
              <div className="grid grid-cols-2 bg-gray-50 p-2 border-b text-sm font-medium text-center">
                <div>Parametr</div>
                <div>Hodnota</div>
              </div>
              
              <div className="grid grid-cols-2 p-2 border-b hover:bg-gray-50">
                <div className="text-center">Kusů v krabici</div>
                <div className="flex items-center justify-center gap-2">
                  {editingProduct === `${product.id}-box` ? (
                    <>
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
                      <button
                        onClick={() => setEditingProduct(null)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        ✓
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{product.items_per_box}</span>
                      <button
                        onClick={() => setEditingProduct(`${product.id}-box`)}
                        className="text-gray-400 hover:text-blue-600"
                        title="Upravit hodnotu"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 p-2 hover:bg-gray-50">
                <div className="text-center">1ks zabírá (%) palety</div>
                <div className="flex items-center justify-center gap-2">
                  {editingProduct === `${product.id}-pallet` ? (
                    <>
                      <input
                        type="number"
                        value={(product.palette_percentage * 100).toFixed(1)}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value)
                          if (!isNaN(value)) {
                            updateProduct(product.id, { palette_percentage: value / 100 })
                          }
                        }}
                        className="border rounded w-20 px-2 py-1 text-right"
                        step="0.1"
                      />
                      <button
                        onClick={() => setEditingProduct(null)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        ✓
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{(product.palette_percentage * 100).toFixed(1)}</span>
                      <button
                        onClick={() => setEditingProduct(`${product.id}-pallet`)}
                        className="text-gray-400 hover:text-blue-600"
                        title="Upravit hodnotu"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Products
