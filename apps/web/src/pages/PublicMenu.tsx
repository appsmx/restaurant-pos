import { useEffect, useState } from 'react';

/**
 * Menú Digital Público — visible por clientes sin login
 * Se accede escaneando QR de la mesa o entrando a /menu
 */

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

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

export default function PublicMenu() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [config, setConfig] = useState<{ name: string; phone: string | null }>({ name: 'Restaurante', phone: null });
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const [menuRes, configRes] = await Promise.all([
          fetch(`${API_URL}/public/menu`),
          fetch(`${API_URL}/public/config`),
        ]);
        const menuData = await menuRes.json();
        const configData = await configRes.json();
        setCategories(menuData);
        setConfig(configData);
        if (menuData.length > 0) setActiveCategory(menuData[0].id);
      } catch (err) {
        console.error('Error loading menu');
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, []);

  // Get table name from URL params (e.g., /menu?mesa=Mesa%201)
  const params = new URLSearchParams(window.location.search);
  const tableName = params.get('mesa');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Cargando menú...</p>
      </div>
    );
  }

  const selectedCategory = categories.find((c) => c.id === activeCategory);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{config.name}</h1>
            {tableName && <p className="text-blue-400 text-xs">🍽️ {tableName}</p>}
          </div>
          <span className="text-2xl">📋</span>
        </div>
      </div>

      {/* Category tabs */}
      <div className="sticky top-[57px] z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-4 py-2">
        <div className="max-w-lg mx-auto flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0 ${
                activeCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {selectedCategory && (
          <>
            <h2 className="text-lg font-bold mb-3">{selectedCategory.name}</h2>
            <div className="space-y-3">
              {selectedCategory.products.map((product) => (
                <div key={product.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium text-base">{product.name}</h3>
                      {product.description && (
                        <p className="text-gray-500 text-sm mt-0.5">{product.description}</p>
                      )}
                    </div>
                    <span className="text-emerald-400 font-bold text-lg ml-3 shrink-0">
                      ${product.price.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {categories.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-3xl mb-2">📋</p>
            <p>El menú aún no está disponible</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-lg mx-auto px-4 py-6 text-center">
        <p className="text-gray-600 text-xs">
          {config.name} {config.phone ? `· ${config.phone}` : ''}
        </p>
        <p className="text-gray-700 text-xs mt-1">Precios en MXN · Sujetos a cambio</p>
        <a
          href="https://logancorp.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-700 hover:text-gray-500 text-[10px] mt-3 inline-block transition-colors"
        >
          ⚡ Powered by Logan
        </a>
      </div>
    </div>
  );
}
