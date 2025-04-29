import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { EditIcon, DeleteIcon, CheckIcon } from './icons'

const API_URL = import.meta.env.PROD 
  ? '/.netlify/functions'
  : 'http://localhost:3001';

const Products = () => {
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingProduct, setEditingProduct] = useState(null)
  const [showNewProductForm, setShowNewProductForm] = useState(false)
  const [newProduct, setNewProduct] = useState({
    name: '',
    code: '',
    image_url: '',
    parcel_disabled: false,
    multiple_boxes: false,
    boxes_per_item: 1,
    items_per_box: 1,
    items_per_pallet: 0,
    pallet_disabled: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [imagePreview, setImagePreview] = useState(null)
  const [imageError, setImageError] = useState(false)

  const generateCodeFromName = (name) => {
    const timestamp = Date.now().toString(36);
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // odstranění diakritiky
      .replace(/[^a-z0-9]+/g, '-') // nahrazení mezer a spec. znaků pomlčkou
      .replace(/^-+|-+$/g, ''); // odstranění pomlček na začátku a konci
    return `${base}-${timestamp}`;
  }

  const validateImageUrl = (url) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        setImageError(false)
        setImagePreview(url)
        resolve(true)
      }
      img.onerror = () => {
        setImageError(true)
        setImagePreview(null)
        resolve(false)
      }
      img.src = url
    })
  }

  const logToAudit = async (action, details) => {
    try {
      const response = await fetch(`${API_URL}/audit-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          details
          // odstranit timestamp, použijeme created_at v databázi
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to log action');
      console.log('Audit log success:', data);
    } catch (error) {
      console.error('Audit log error:', error);
    }
  };

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
      // If we're disabling parcel shipping, set items_per_box to null
      const finalUpdates = {
        ...updates,
        items_per_box: updates.parcel_disabled ? null : updates.items_per_box
      };

      const { error } = await supabase
        .from('products')
        .update(finalUpdates)
        .eq('id', productId)

      if (error) throw error

      setProducts(products.map(p => 
        p.id === productId ? { ...p, ...finalUpdates } : p
      ));

      // Log the update
      await logToAudit('PRODUCT_UPDATE', {
        productId,
        updates: finalUpdates
      });
    } catch (err) {
      console.error('Chyba při ukládání:', err)
    }
  }

  const addNewProduct = async () => {
    if (isSubmitting) return; // Prevent double submission
    
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Validate image URL first
      const isValidImage = await validateImageUrl(newProduct.image_url)
      if (!isValidImage) {
        setSubmitError('Neplatná URL obrázku')
        setIsSubmitting(false)
        return
      }

      const productCode = generateCodeFromName(newProduct.name);
      const { data, error } = await supabase
        .from('products')
        .insert([{
          ...newProduct,
          code: productCode,
          name: newProduct.name.trim(),
          items_per_box: parseInt(newProduct.items_per_box),
          items_per_pallet: parseInt(newProduct.items_per_pallet),
          image_url: newProduct.image_url.trim()
        }])
        .select()

      if (error) throw error

      console.log('Produkt úspěšně vytvořen:', data)
      setProducts([...products, data[0]])
      setShowNewProductForm(false)
      setImagePreview(null)
      setImageError(false)

      // Log the creation
      await logToAudit('PRODUCT_CREATE', {
        productId: data[0].id,
        productName: data[0].name
      });
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
      const productToDelete = products.find(p => p.id === deletingProduct);
      
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deletingProduct);

      if (error) throw error;

      // Log the deletion
      await logToAudit('PRODUCT_DELETE', {
        productId: deletingProduct,
        productName: productToDelete?.name
      });

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full relative z-[10000]">
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
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newProduct.image_url}
                    onChange={async (e) => {
                      const url = e.target.value
                      setNewProduct({ ...newProduct, image_url: url })
                      if (url) {
                        await validateImageUrl(url)
                      } else {
                        setImagePreview(null)
                        setImageError(false)
                      }
                    }}
                    className={`border p-2 w-full rounded ${
                      imageError ? 'border-red-500' : ''
                    }`}
                    placeholder="https://..."
                  />
                  {imageError && (
                    <p className="text-red-500 text-sm">Obrázek není dostupný</p>
                  )}
                  {imagePreview && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600 mb-1">Náhled:</p>
                      <img
                        src={imagePreview}
                        alt="Náhled"
                        className="h-32 w-full object-contain border rounded"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2 mb-1">
                  <input
                    type="checkbox"
                    checked={!newProduct.parcel_disabled}
                    onChange={(e) => setNewProduct({ 
                      ...newProduct, 
                      parcel_disabled: !e.target.checked,
                      items_per_box: !e.target.checked ? null : newProduct.items_per_box 
                    })}
                    className="w-4 h-4"
                  />
                  <span>Povolit balíkovou přepravu</span>
                </label>
              </div>

              {!newProduct.parcel_disabled && (
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
              )}

              <div>
                <label className="block mb-1">Počet kusů na paletě</label>
                <input
                  type="number"
                  value={newProduct.items_per_pallet}
                  onChange={(e) => setNewProduct({ ...newProduct, items_per_pallet: e.target.value })}
                  className="border p-2 w-full rounded"
                  min="1"
                />
              </div>

              <div className="space-y-4 mb-4">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newProduct.parcel_disabled}
                      onChange={(e) => setNewProduct({ ...newProduct, parcel_disabled: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span>Zakázat balík</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newProduct.multiple_boxes}
                      onChange={(e) => setNewProduct({ ...newProduct, multiple_boxes: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span>Více krabic na položku</span>
                  </label>
                </div>

                {newProduct.multiple_boxes && (
                  <div>
                    <label className="block mb-1">Počet krabic na položku</label>
                    <input
                      type="number"
                      value={newProduct.boxes_per_item}
                      onChange={(e) => setNewProduct({ ...newProduct, boxes_per_item: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="border p-1 w-full"
                    />
                  </div>
                )}
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
                {editingProduct === `${product.id}-image` ? (
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={product.image_url}
                      onChange={(e) => {
                        const updatedProduct = { ...product, image_url: e.target.value };
                        updateProduct(product.id, { image_url: e.target.value });
                        setProducts(products.map(p => 
                          p.id === product.id ? updatedProduct : p
                        ));
                      }}
                      className="border rounded px-2 py-1 w-full"
                      placeholder="URL obrázku..."
                    />
                    <button
                      onClick={() => setEditingProduct(null)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <CheckIcon />
                    </button>
                  </div>
                ) : (
                  <div className="relative group">
                    <img 
                      src={product.image_url} 
                      alt={product.name} 
                      className="h-32 w-full object-contain" 
                    />
                    <button
                      onClick={() => setEditingProduct(`${product.id}-image`)}
                      className="absolute top-0 right-0 bg-white/80 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Upravit URL obrázku"
                    >
                      <EditIcon />
                    </button>
                  </div>
                )}

                {editingProduct === `${product.id}-name` ? (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={product.name}
                      onChange={(e) => {
                        const updatedProduct = { ...product, name: e.target.value };
                        updateProduct(product.id, { name: e.target.value });
                        setProducts(products.map(p => 
                          p.id === product.id ? updatedProduct : p
                        ));
                      }}
                      className="border rounded px-2 py-1 w-full"
                    />
                    <button
                      onClick={() => setEditingProduct(null)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <CheckIcon />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-2">
                    <h3 className="text-lg font-semibold">{product.name}</h3>
                    <button
                      onClick={() => setEditingProduct(`${product.id}-name`)}
                      className="text-gray-400 hover:text-blue-600"
                      title="Upravit název"
                    >
                      <EditIcon />
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => deleteProduct(product.id)}
                className="text-red-500 hover:text-red-700 p-1"
                title="Smazat produkt"
              >
                <DeleteIcon />
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
                        disabled={product.parcel_disabled}
                      />
                      <button
                        onClick={() => setEditingProduct(null)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <CheckIcon />
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>
                        {product.parcel_disabled ? "Nelze odeslat na balíky" : product.items_per_box}
                      </span>
                      {!product.parcel_disabled && (
                        <button
                          onClick={() => setEditingProduct(`${product.id}-box`)}
                          className="text-gray-400 hover:text-blue-600"
                          title="Upravit hodnotu"
                        >
                          <EditIcon />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 p-2 hover:bg-gray-50">
                <div className="text-center">Kusů na paletě</div>
                <div className="flex items-center justify-center gap-2">
                  {editingProduct === `${product.id}-pallet` ? (
                    <>
                      <input
                        type="number"
                        value={product.items_per_pallet}
                        onChange={(e) => {
                          const value = parseInt(e.target.value)
                          if (!isNaN(value) && value > 0) {
                            updateProduct(product.id, { items_per_pallet: value })
                          }
                        }}
                        className="border rounded w-20 px-2 py-1 text-right"
                        min="1"
                        disabled={product.pallet_disabled}
                      />
                      <button
                        onClick={() => setEditingProduct(null)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <CheckIcon />
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>
                        {product.pallet_disabled ? "Nelze odeslat na paletě" : product.items_per_pallet}
                      </span>
                      {!product.pallet_disabled && (
                        <button
                          onClick={() => setEditingProduct(`${product.id}-pallet`)}
                          className="text-gray-400 hover:text-blue-600"
                          title="Upravit hodnotu"
                        >
                          <EditIcon />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 p-2 border-b hover:bg-gray-50">
                <div className="text-center">Více krabic na položku</div>
                <div className="flex items-center justify-center gap-2">
                  {editingProduct === `${product.id}-multibox` ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={product.multiple_boxes}
                        onChange={(e) => {
                          updateProduct(product.id, { 
                            multiple_boxes: e.target.checked,
                            boxes_per_item: e.target.checked ? product.boxes_per_item : 1
                          });
                        }}
                        className="w-4 h-4"
                      />
                      {product.multiple_boxes && (
                        <input
                          type="number"
                          value={product.boxes_per_item}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 1;
                            updateProduct(product.id, { boxes_per_item: value });
                          }}
                          className="border rounded w-20 px-2 py-1 text-right"
                          min="1"
                        />
                      )}
                      <button
                        onClick={() => setEditingProduct(null)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <CheckIcon />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>
                        {product.multiple_boxes 
                          ? `Ano (${product.boxes_per_item} krabic/ks)`
                          : "Ne"
                        }
                      </span>
                      <button
                        onClick={() => setEditingProduct(`${product.id}-multibox`)}
                        className="text-gray-400 hover:text-blue-600"
                        title="Upravit hodnotu"
                      >
                        <EditIcon />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 p-2 hover:bg-gray-50">
                <div className="text-center">Omezení dopravy</div>
                <div className="flex flex-col items-center justify-center gap-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!product.parcel_disabled}
                      onChange={(e) => {
                        // Nelze zakázat obě možnosti
                        if (product.pallet_disabled && !e.target.checked) {
                          alert('Nelze zakázat všechny způsoby dopravy')
                          return
                        }
                        updateProduct(product.id, { parcel_disabled: !e.target.checked })
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm">
                      {product.parcel_disabled ? 'Balíky zakázány' : 'Balíky povoleny'}
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!product.pallet_disabled}
                      onChange={(e) => {
                        // Nelze zakázat obě možnosti
                        if (product.parcel_disabled && !e.target.checked) {
                          alert('Nelze zakázat všechny způsoby dopravy')
                          return
                        }
                        updateProduct(product.id, { pallet_disabled: !e.target.checked })
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm">
                      {product.pallet_disabled ? 'Palety zakázány' : 'Palety povoleny'}
                    </span>
                  </label>
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
