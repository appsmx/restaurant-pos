import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface Category {
  id: string;
  name: string;
  products: Product[];
}

export default function MenuBrowser() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const data = await apiClient('/menu/categories', 'GET');
      setCategories(data);
      if (data.length > 0) {
        setActiveCategory(data[0].id);
      }
    } catch (err) {
      setError('Error al cargar el menú');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-lg">Cargando menú...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400 text-lg">{error}</p>
      </div>
    );
  }

  const selectedCategory = categories.find((c) => c.id === activeCategory);

  return (
    <div className="flex h-full gap-6">
      {/* Sidebar de categorías */}
      <div className="w-56 bg-gray-900 rounded-lg p-4 flex flex-col gap-1">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Categorías</h2>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`text-left px-3 py-2.5 rounded-md text-sm transition-colors ${
              activeCategory === category.id
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            {category.name}
            <span className={`ml-2 text-xs ${activeCategory === category.id ? 'text-blue-200' : 'text-gray-500'}`}>
              ({category.products?.length || 0})
            </span>
          </button>
        ))}
      </div>

      {/* Grid de productos */}
      <div className="flex-1 overflow-auto">
        {selectedCategory ? (
          <>
            <h1 className="text-2xl font-bold mb-6">{selectedCategory.name}</h1>
            {selectedCategory.products && selectedCategory.products.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {selectedCategory.products.map((product) => (
                  <button
                    key={product.id}
                    className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500 rounded-lg p-4 text-left transition-colors group"
                  >
                    <div className="flex-1">
                      <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-gray-500 text-xs mt-1 line-clamp-2">{product.description}</p>
                      )}
                    </div>
                    <p className="text-emerald-400 font-bold mt-3">
                      ${product.price?.toFixed(2)}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
                <p>No hay productos en esta categoría</p>
              </div>
            )}
          </>
        ) : (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
            <p>Seleccioná una categoría</p>
          </div>
        )}
      </div>
    </div>
  );
}