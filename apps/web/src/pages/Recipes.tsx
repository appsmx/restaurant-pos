import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

// ==================== INTERFACES ====================

interface Product {
  id: string;
  name: string;
  price: number;
  category?: { name: string };
}

interface Category {
  id: string;
  name: string;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stock: number;
}

interface RecipeIngredientItem {
  id: string;
  quantity: number;
  ingredient: {
    id: string;
    name: string;
    unit: string;
    stock: number;
  };
}

interface Recipe {
  product: { id: string; name: string };
  ingredients: RecipeIngredientItem[];
}

// ==================== COMPONENT ====================

export default function Recipes() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchProduct, setSearchProduct] = useState('');
  const [error, setError] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addIngredientId, setAddIngredientId] = useState('');
  const [addQuantity, setAddQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState('');

  // ==================== DATA FETCHING ====================

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsData, categoriesData, ingredientsData] = await Promise.all([
        apiClient('/menu/products', 'GET'),
        apiClient('/menu/categories', 'GET'),
        apiClient('/inventory/ingredients', 'GET'),
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
      setIngredients(ingredientsData);
    } catch (err) {
      setError('Error al cargar datos. Verifica permisos de administrador.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipe = async (productId: string) => {
    try {
      setLoadingRecipe(true);
      const data = await apiClient(`/inventory/recipes/${productId}`, 'GET');
      setRecipe(data);
    } catch (err) {
      setRecipe({ product: { id: productId, name: selectedProduct?.name || '' }, ingredients: [] });
    } finally {
      setLoadingRecipe(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchRecipe(selectedProduct.id);
    }
  }, [selectedProduct]);

  // ==================== ACTIONS ====================

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setEditingId(null);
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !addIngredientId || !addQuantity) return;
    setSubmitting(true);
    try {
      await apiClient(`/inventory/recipes/${selectedProduct.id}/ingredients`, 'POST', {
        ingredientId: addIngredientId,
        quantity: parseFloat(addQuantity),
      });
      setShowAddModal(false);
      setAddIngredientId('');
      setAddQuantity('');
      fetchRecipe(selectedProduct.id);
    } catch (err: any) {
      alert(err.message || 'Error al agregar ingrediente');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateQuantity = async (recipeIngredientId: string) => {
    if (!selectedProduct || !editQuantity) return;
    setSubmitting(true);
    try {
      // Use the PUT endpoint to update the whole recipe, or add/update single ingredient
      const ingredient = recipe?.ingredients.find((ri) => ri.id === recipeIngredientId);
      if (!ingredient) return;

      await apiClient(`/inventory/recipes/${selectedProduct.id}/ingredients`, 'POST', {
        ingredientId: ingredient.ingredient.id,
        quantity: parseFloat(editQuantity),
      });
      setEditingId(null);
      setEditQuantity('');
      fetchRecipe(selectedProduct.id);
    } catch (err: any) {
      alert(err.message || 'Error al actualizar cantidad');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveIngredient = async (recipeIngredientId: string) => {
    if (!selectedProduct) return;
    if (!confirm('¿Eliminar este ingrediente de la receta?')) return;
    try {
      await apiClient(`/inventory/recipes/items/${recipeIngredientId}`, 'DELETE');
      fetchRecipe(selectedProduct.id);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar ingrediente');
    }
  };

  const startEdit = (ri: RecipeIngredientItem) => {
    setEditingId(ri.id);
    setEditQuantity(ri.quantity.toString());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQuantity('');
  };

  // ==================== FILTERING ====================

  const filteredProducts = products.filter((p) => {
    const matchesCategory = filterCategory === 'all' || p.category?.name === filterCategory;
    const matchesSearch = !searchProduct || p.name.toLowerCase().includes(searchProduct.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Ingredients not yet in the recipe
  const availableIngredients = ingredients.filter(
    (ing) => !recipe?.ingredients.some((ri) => ri.ingredient.id === ing.id)
  );

  // ==================== RENDER ====================

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-lg">Cargando recetas...</p></div>;
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-red-400 text-lg text-center px-4">{error}</p></div>;

  return (
    <div className="h-full">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold">🧑‍🍳 Recetas</h1>
        <p className="text-gray-500 text-xs md:text-sm mt-0.5">Configura los ingredientes de cada platillo</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        {/* ==================== LEFT: Product selector ==================== */}
        <div className="lg:col-span-5">
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700">
              <h2 className="text-white font-semibold text-sm">📋 Seleccionar platillo</h2>
            </div>

            {/* Filters */}
            <div className="px-3 py-2 border-b border-gray-700/50 space-y-2">
              <input
                type="text"
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="w-full bg-gray-900 text-white text-sm rounded-lg border border-gray-600 px-3 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="🔍 Buscar platillo..."
              />
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    filterCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  Todos
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterCategory(cat.name)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      filterCategory === cat.name ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Product list */}
            <div className="max-h-[400px] md:max-h-[500px] overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">No hay productos que coincidan</p>
              ) : (
                <div className="divide-y divide-gray-700/50">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-700/50 ${
                        selectedProduct?.id === product.id ? 'bg-blue-600/10 border-l-2 border-l-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium truncate ${selectedProduct?.id === product.id ? 'text-blue-400' : 'text-white'}`}>
                            {product.name}
                          </p>
                          <p className="text-gray-500 text-xs mt-0.5">{product.category?.name || 'Sin categoría'}</p>
                        </div>
                        <span className="text-gray-400 text-xs font-mono ml-2">${product.price}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ==================== RIGHT: Recipe editor ==================== */}
        <div className="lg:col-span-7">
          {!selectedProduct ? (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
              <p className="text-4xl mb-3">👈</p>
              <p className="text-gray-400 text-sm">Selecciona un platillo para ver y editar su receta</p>
              <p className="text-gray-600 text-xs mt-2">Los ingredientes que asignes se descontarán automáticamente al vender el platillo</p>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              {/* Recipe header */}
              <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-semibold text-sm md:text-base">
                    🧾 Receta: {selectedProduct.name}
                  </h2>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {recipe?.ingredients.length || 0} ingrediente{recipe?.ingredients.length !== 1 ? 's' : ''} configurado{recipe?.ingredients.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(true);
                    setAddIngredientId('');
                    setAddQuantity('');
                  }}
                  disabled={availableIngredients.length === 0}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                >
                  ➕ Agregar ingrediente
                </button>
              </div>

              {/* Recipe content */}
              {loadingRecipe ? (
                <div className="p-8 text-center"><p className="text-gray-400 text-sm">Cargando receta...</p></div>
              ) : !recipe || recipe.ingredients.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-3xl mb-2">📝</p>
                  <p className="text-gray-400 text-sm">Este platillo no tiene receta configurada</p>
                  <p className="text-gray-600 text-xs mt-1">Agrega ingredientes para activar el descuento automático de stock</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/50">
                  {recipe.ingredients.map((ri) => (
                    <div key={ri.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{ri.ingredient.name}</span>
                          {ri.ingredient.stock <= 3 && (
                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded-full font-medium">Stock bajo</span>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs mt-0.5">
                          Stock actual: <span className={ri.ingredient.stock <= 3 ? 'text-red-400' : ri.ingredient.stock <= 10 ? 'text-amber-400' : 'text-emerald-400'}>{ri.ingredient.stock}</span> {ri.ingredient.unit}
                        </p>
                      </div>

                      {/* Quantity display/edit */}
                      <div className="flex items-center gap-2">
                        {editingId === ri.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              className="w-20 bg-gray-900 text-white text-sm rounded-lg border border-blue-500 px-2 py-1.5 focus:outline-none text-center"
                              step="0.01"
                              min="0.01"
                              autoFocus
                            />
                            <span className="text-gray-500 text-xs">{ri.ingredient.unit}</span>
                            <button
                              onClick={() => handleUpdateQuantity(ri.id)}
                              disabled={submitting || !editQuantity || parseFloat(editQuantity) <= 0}
                              className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white text-xs rounded-lg"
                            >
                              ✓
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-2 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(ri)}
                              className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors"
                              title="Editar cantidad"
                            >
                              <span className="font-mono font-bold text-blue-400">{ri.quantity}</span>
                              <span className="text-gray-400 ml-1">{ri.ingredient.unit}</span>
                            </button>
                            <button
                              onClick={() => handleRemoveIngredient(ri.id)}
                              className="px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-lg transition-colors"
                              title="Eliminar de la receta"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Cost estimation */}
              {recipe && recipe.ingredients.length > 0 && (
                <div className="px-4 py-3 bg-gray-900/50 border-t border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">
                      💡 Al vender 1x {selectedProduct.name}, se descontarán estos ingredientes automáticamente
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ==================== MODAL: Agregar ingrediente a receta ==================== */}
      {showAddModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-700">
            <h2 className="text-white font-bold text-lg mb-1">➕ Agregar ingrediente</h2>
            <p className="text-gray-400 text-sm mb-4">
              Receta de: <span className="text-blue-400 font-medium">{selectedProduct.name}</span>
            </p>
            <form onSubmit={handleAddIngredient} className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Ingrediente</label>
                {availableIngredients.length === 0 ? (
                  <p className="text-amber-400 text-sm bg-amber-500/10 rounded-lg p-3">
                    ⚠️ Todos los ingredientes ya están en esta receta. Crea nuevos ingredientes desde Inventario.
                  </p>
                ) : (
                  <select
                    value={addIngredientId}
                    onChange={(e) => setAddIngredientId(e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">Seleccionar ingrediente...</option>
                    {availableIngredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.stock} {ing.unit} disponibles)
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">
                  Cantidad por platillo
                  {addIngredientId && (
                    <span className="text-gray-600 ml-1">
                      ({ingredients.find((i) => i.id === addIngredientId)?.unit || 'UNIT'})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: 0.5, 2, 100..."
                  step="0.01"
                  min="0.01"
                  required
                />
                <p className="text-gray-600 text-xs mt-1">Cantidad que se usa cada vez que se vende este platillo</p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !addIngredientId || !addQuantity || availableIngredients.length === 0}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {submitting ? 'Guardando...' : '✓ Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
