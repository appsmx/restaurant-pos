import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

// ==================== INTERFACES ====================

interface Category {
  id: string;
  name: string;
  sort: number;
  active: boolean;
  _count: { products: number };
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  categoryId: string;
  active: boolean;
  category: { name: string };
  _count: { ingredients: number };
}

type ModalType = 'none' | 'createCategory' | 'editCategory' | 'createProduct' | 'editProduct';

// ==================== COMPONENT ====================

export default function MenuAdmin() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);

  // Modal state
  const [modal, setModal] = useState<ModalType>('none');
  const [submitting, setSubmitting] = useState(false);

  // Category form
  const [catName, setCatName] = useState('');
  const [catSort, setCatSort] = useState('0');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Product form
  const [prodName, setProdName] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState('');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // ==================== DATA FETCHING ====================

  const fetchData = async () => {
    try {
      setLoading(true);
      const [catsData, prodsData] = await Promise.all([
        apiClient('/menu/categories/all', 'GET'),
        apiClient('/menu/products/all', 'GET'),
      ]);
      setCategories(catsData);
      setProducts(prodsData);
    } catch (err) {
      setError('Error al cargar. Verifica permisos de administrador.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ==================== CATEGORY ACTIONS ====================

  const openCreateCategory = () => {
    setCatName('');
    setCatSort(String(categories.length));
    setEditingCategory(null);
    setModal('createCategory');
  };

  const openEditCategory = (cat: Category) => {
    setCatName(cat.name);
    setCatSort(String(cat.sort));
    setEditingCategory(cat);
    setModal('editCategory');
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingCategory) {
        await apiClient(`/menu/categories/${editingCategory.id}`, 'PATCH', {
          name: catName,
          sort: parseInt(catSort) || 0,
        });
      } else {
        await apiClient('/menu/categories', 'POST', {
          name: catName,
          sort: parseInt(catSort) || 0,
        });
      }
      setModal('none');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al guardar categoría');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCategory = async (cat: Category) => {
    try {
      await apiClient(`/menu/categories/${cat.id}`, 'PATCH', { active: !cat.active });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado');
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!confirm(`¿Eliminar categoría "${cat.name}"? Solo funciona si no tiene productos.`)) return;
    try {
      await apiClient(`/menu/categories/${cat.id}`, 'DELETE');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar');
    }
  };

  // ==================== PRODUCT ACTIONS ====================

  const openCreateProduct = () => {
    setProdName('');
    setProdDescription('');
    setProdPrice('');
    setProdCategoryId(categories.filter((c) => c.active)[0]?.id || '');
    setProdImageUrl('');
    setEditingProduct(null);
    setModal('createProduct');
  };

  const openEditProduct = (prod: Product) => {
    setProdName(prod.name);
    setProdDescription(prod.description || '');
    setProdPrice(String(prod.price));
    setProdCategoryId(prod.categoryId);
    setProdImageUrl(prod.imageUrl || '');
    setEditingProduct(prod);
    setModal('editProduct');
  };

  // Compress image client-side then upload to backend
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      // Compress + resize client-side using canvas (max 800px, JPEG 0.8)
      const compressed = await compressImage(file, 800, 0.8);

      const formData = new FormData();
      formData.append('image', compressed, 'product.jpg');

      const token = localStorage.getItem('pos_token');
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/upload/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.message || 'Error al subir imagen');
      } else {
        setProdImageUrl(data.imageUrl);
      }
    } catch (err: any) {
      alert(err.message || 'Error al procesar la imagen');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingProduct) {
        await apiClient(`/menu/products/${editingProduct.id}`, 'PATCH', {
          name: prodName,
          description: prodDescription || undefined,
          imageUrl: prodImageUrl || '',
          price: parseFloat(prodPrice),
          categoryId: prodCategoryId,
        });
      } else {
        await apiClient('/menu/products', 'POST', {
          name: prodName,
          description: prodDescription || undefined,
          imageUrl: prodImageUrl || undefined,
          price: parseFloat(prodPrice),
          categoryId: prodCategoryId,
        });
      }
      setModal('none');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al guardar producto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleProduct = async (prod: Product) => {
    try {
      await apiClient(`/menu/products/${prod.id}`, 'PATCH', { active: !prod.active });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar disponibilidad');
    }
  };

  // ==================== FILTERING ====================

  const filteredProducts = products.filter((p) => {
    const matchesCategory = filterCategory === 'all' || p.categoryId === filterCategory;
    const matchesActive = showInactive || p.active;
    return matchesCategory && matchesActive;
  });

  // ==================== RENDER ====================

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-lg">Cargando menú...</p></div>;
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-red-400 text-lg text-center px-4">{error}</p></div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">📋 Gestión de Menú</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            {categories.filter((c) => c.active).length} categorías · {products.filter((p) => p.active).length} productos activos
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={openCreateCategory} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-xl transition-colors">
            ➕ Categoría
          </button>
          <button onClick={openCreateProduct} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl transition-colors">
            ➕ Producto
          </button>
        </div>
      </div>

      {/* ==================== CATEGORÍAS SECTION ==================== */}
      <div className="mb-6">
        <h2 className="text-white font-semibold text-sm mb-3">📂 Categorías</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`rounded-xl border p-3 flex items-center justify-between ${
                cat.active ? 'bg-gray-800 border-gray-700' : 'bg-gray-800/50 border-gray-700/50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-gray-500 text-xs font-mono">#{cat.sort}</span>
                <span className={`text-sm font-medium truncate ${cat.active ? 'text-white' : 'text-gray-500 line-through'}`}>
                  {cat.name}
                </span>
                <span className="text-gray-600 text-xs shrink-0">({cat._count.products})</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEditCategory(cat)}
                  className="px-2 py-1 text-gray-400 hover:text-white text-xs rounded transition-colors"
                  title="Editar"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleToggleCategory(cat)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    cat.active ? 'text-emerald-400 hover:text-emerald-300' : 'text-red-400 hover:text-red-300'
                  }`}
                  title={cat.active ? 'Desactivar' : 'Activar'}
                >
                  {cat.active ? '👁️' : '👁️‍🗨️'}
                </button>
                {cat._count.products === 0 && (
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="px-2 py-1 text-red-400 hover:text-red-300 text-xs rounded transition-colors"
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ==================== PRODUCTOS SECTION ==================== */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <h2 className="text-white font-semibold text-sm">🍽️ Productos</h2>
          <div className="flex items-center gap-2">
            {/* Filter by category */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-gray-800 text-white text-xs rounded-lg border border-gray-700 px-2 py-1.5 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            {/* Toggle inactive */}
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              Mostrar inactivos
            </label>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
            <p>No hay productos {filterCategory !== 'all' ? 'en esta categoría' : ''}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProducts.map((prod) => (
              <div
                key={prod.id}
                className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                  prod.active ? 'bg-gray-800 border-gray-700' : 'bg-gray-800/50 border-red-500/20 opacity-70'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${prod.active ? 'text-white' : 'text-gray-500 line-through'}`}>
                        {prod.name}
                      </span>
                      {!prod.active && (
                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded-full">Inactivo</span>
                      )}
                      {prod._count.ingredients > 0 && (
                        <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] rounded-full">
                          🧑‍🍳 {prod._count.ingredients} ing.
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gray-500 text-xs">{prod.category.name}</span>
                      {prod.description && (
                        <>
                          <span className="text-gray-700 text-xs">·</span>
                          <span className="text-gray-600 text-xs truncate">{prod.description}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-emerald-400 font-bold text-sm font-mono">${prod.price}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditProduct(prod)}
                      className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleToggleProduct(prod)}
                      className={`px-2 py-1.5 text-xs rounded-lg transition-colors ${
                        prod.active
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                      }`}
                      title={prod.active ? 'Desactivar (no disponible)' : 'Activar'}
                    >
                      {prod.active ? '⛔' : '✅'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================== MODAL: Categoría ==================== */}
      {(modal === 'createCategory' || modal === 'editCategory') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal('none')} />
          <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-700">
            <h2 className="text-white font-bold text-lg mb-4">
              {modal === 'editCategory' ? '✏️ Editar categoría' : '➕ Nueva categoría'}
            </h2>
            <form onSubmit={handleSaveCategory} className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Nombre</label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Mariscos, Bebidas, Postres..."
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Orden (posición en el menú)</label>
                <input
                  type="number"
                  value={catSort}
                  onChange={(e) => setCatSort(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  min="0"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal('none')} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting || !catName} className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-xl transition-colors">
                  {submitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: Producto ==================== */}
      {(modal === 'createProduct' || modal === 'editProduct') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal('none')} />
          <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-700">
            <h2 className="text-white font-bold text-lg mb-4">
              {modal === 'editProduct' ? '✏️ Editar producto' : '➕ Nuevo producto'}
            </h2>
            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Nombre</label>
                <input
                  type="text"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Coctel de Camarón"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Descripción (opcional)</label>
                <input
                  type="text"
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Descripción corta..."
                />
              </div>

              {/* Foto del producto */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Foto del producto (opcional)</label>
                <div className="flex items-center gap-3">
                  {/* Preview */}
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-800 border border-gray-600 shrink-0 flex items-center justify-center">
                    {prodImageUrl ? (
                      <img src={prodImageUrl} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-600 text-2xl">🍽️</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      id="product-image-upload"
                      disabled={uploadingImage}
                    />
                    <label
                      htmlFor="product-image-upload"
                      className={`block w-full text-center py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        uploadingImage
                          ? 'bg-gray-700 text-gray-500'
                          : 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30'
                      }`}
                    >
                      {uploadingImage ? '⏳ Procesando...' : prodImageUrl ? '🔄 Cambiar foto' : '📷 Subir foto'}
                    </label>
                    {prodImageUrl && !uploadingImage && (
                      <button
                        type="button"
                        onClick={() => setProdImageUrl('')}
                        className="w-full text-center mt-1.5 text-red-400 hover:text-red-300 text-[11px] transition-colors"
                      >
                        Quitar foto
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-gray-600 text-[10px] mt-1">Se comprime automáticamente. Se ve en el menú digital.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Precio ($)</label>
                  <input
                    type="number"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                    placeholder="180"
                    min="0"
                    step="0.5"
                    required
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Categoría</label>
                  <select
                    value={prodCategoryId}
                    onChange={(e) => setProdCategoryId(e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {categories.filter((c) => c.active).map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal('none')} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting || !prodName || !prodPrice || !prodCategoryId} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-xl transition-colors">
                  {submitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


// ==================== IMAGE COMPRESSION HELPER ====================

/**
 * Compress and resize an image client-side using a canvas.
 * Keeps aspect ratio, caps the longest side at maxSize, exports as JPEG.
 */
function compressImage(file: File, maxSize: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Scale down if larger than maxSize
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('No se pudo comprimir la imagen'));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Imagen inválida'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}
