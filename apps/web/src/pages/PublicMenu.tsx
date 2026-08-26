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
  imageUrl?: string;
}

interface Category {
  id: string;
  name: string;
  icon?: string;
  products: Product[];
}

// Placeholder images for demo (user will replace with real photos)
const PLACEHOLDER_IMAGES: Record<string, string> = {
  'Mariscos': 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=400&h=300&fit=crop',
  'Entradas': 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=400&h=300&fit=crop',
  'Bebidas': 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop',
  'Postres': 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=300&fit=crop',
  'Sopas': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop',
  'Carnes': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop',
  'Ensaladas': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
  'Tacos': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop',
};

const CATEGORY_ICONS: Record<string, string> = {
  'Mariscos': '🦐',
  'Entradas': '🥗',
  'Bebidas': '🍹',
  'Postres': '🍰',
  'Sopas': '🍲',
  'Carnes': '🥩',
  'Ensaladas': '🥬',
  'Tacos': '🌮',
  'Cocteles': '🍸',
  'Ceviches': '🐟',
};

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

export default function PublicMenu() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [config, setConfig] = useState<{ name: string; phone: string | null }>({ name: 'Restaurante', phone: null });
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        // Get tenant slug from URL (e.g., /menu?t=quiroa or /menu?slug=quiroa)
        const urlParams = new URLSearchParams(window.location.search);
        const slug = urlParams.get('t') || urlParams.get('slug') || '';
        const slugParam = slug ? `?slug=${slug}` : '';

        const [menuRes, configRes] = await Promise.all([
          fetch(`${API_URL}/public/menu${slugParam}`),
          fetch(`${API_URL}/public/config${slugParam}`),
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

  // Get table name from URL params
  const params = new URLSearchParams(window.location.search);
  const tableName = params.get('mesa');

  // Filter products by search
  const getFilteredProducts = (): Product[] => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const allProducts: Product[] = [];
    for (const cat of categories) {
      for (const prod of cat.products) {
        if (prod.name.toLowerCase().includes(query) || prod.description?.toLowerCase().includes(query)) {
          allProducts.push(prod);
        }
      }
    }
    return allProducts;
  };

  const filteredProducts = getFilteredProducts();
  const isSearching = searchQuery.trim().length > 0;
  const selectedCategory = categories.find((c) => c.id === activeCategory);

  // Get a placeholder image based on category name
  const getProductImage = (product: Product, categoryName?: string): string | null => {
    if (product.imageUrl) return product.imageUrl;
    if (categoryName && PLACEHOLDER_IMAGES[categoryName]) return PLACEHOLDER_IMAGES[categoryName];
    return null;
  };

  const getCategoryIcon = (name: string): string => {
    return CATEGORY_ICONS[name] || '🍽️';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Cargando menú...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header — Hero style */}
      <div className="bg-gradient-to-b from-gray-800 to-gray-950 px-4 pt-8 pb-4">
        <div className="max-w-lg mx-auto text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3 shadow-lg shadow-blue-600/20">
            {config.name[0]?.toUpperCase() || '🍽️'}
          </div>
          <h1 className="text-2xl font-bold">{config.name}</h1>
          {tableName && (
            <p className="text-blue-400 text-sm mt-1 bg-blue-500/10 inline-block px-3 py-1 rounded-full">
              🍽️ {tableName}
            </p>
          )}
          {config.phone && (
            <p className="text-gray-500 text-xs mt-2">📞 {config.phone}</p>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="sticky top-0 z-20 bg-gray-950/95 backdrop-blur-md px-4 py-3 border-b border-gray-800/50">
        <div className="max-w-lg mx-auto">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar platillo..."
              className="w-full bg-gray-800/80 text-white text-sm rounded-xl border border-gray-700 pl-10 pr-4 py-2.5 focus:border-blue-500 focus:outline-none placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category tabs (hidden when searching) */}
      {!isSearching && (
        <div className="sticky top-[57px] z-10 bg-gray-950/95 backdrop-blur-md border-b border-gray-800/50 px-4 py-2.5">
          <div className="max-w-lg mx-auto flex gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all shrink-0 ${
                  activeCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-105'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <span className="mr-1">{getCategoryIcon(cat.name)}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div className="max-w-lg mx-auto px-4 py-5">
        {/* Search results */}
        {isSearching && (
          <>
            <p className="text-gray-400 text-sm mb-3">
              {filteredProducts.length > 0
                ? `${filteredProducts.length} resultado${filteredProducts.length !== 1 ? 's' : ''} para "${searchQuery}"`
                : `Sin resultados para "${searchQuery}"`}
            </p>
            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  expanded={expandedProduct === product.id}
                  onToggle={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Category view */}
        {!isSearching && selectedCategory && (
          <>
            {/* Category header with cover image */}
            {PLACEHOLDER_IMAGES[selectedCategory.name] && (
              <div className="rounded-2xl overflow-hidden mb-4 relative h-32">
                <img
                  src={PLACEHOLDER_IMAGES[selectedCategory.name]}
                  alt={selectedCategory.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />
                <div className="absolute bottom-3 left-4">
                  <h2 className="text-xl font-bold text-white drop-shadow-lg">
                    {getCategoryIcon(selectedCategory.name)} {selectedCategory.name}
                  </h2>
                  <p className="text-gray-300 text-xs">{selectedCategory.products.length} platillos</p>
                </div>
              </div>
            )}

            {!PLACEHOLDER_IMAGES[selectedCategory.name] && (
              <h2 className="text-xl font-bold mb-4">
                {getCategoryIcon(selectedCategory.name)} {selectedCategory.name}
              </h2>
            )}

            <div className="space-y-3">
              {selectedCategory.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  categoryName={selectedCategory.name}
                  expanded={expandedProduct === product.id}
                  onToggle={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                />
              ))}
            </div>
          </>
        )}

        {categories.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">📋</p>
            <p className="text-lg font-medium">Menú no disponible</p>
            <p className="text-sm mt-1">Consulta con el mesero</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-lg mx-auto px-4 py-8 text-center border-t border-gray-800/50 mt-6">
        <p className="text-gray-500 text-sm font-medium">{config.name}</p>
        {config.phone && <p className="text-gray-600 text-xs mt-1">📞 {config.phone}</p>}
        <p className="text-gray-700 text-xs mt-2">Precios en MXN · Sujetos a cambio sin previo aviso</p>
        <p className="text-gray-700 text-xs mt-1">Algunos platillos pueden contener alérgenos. Consulta con tu mesero.</p>
        <a
          href="https://logancorp.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-700 hover:text-gray-500 text-[10px] mt-4 inline-block transition-colors"
        >
          ⚡ Powered by Logan
        </a>
      </div>
    </div>
  );
}

// ==================== Product Card Component ====================

interface ProductCardProps {
  product: Product;
  categoryName?: string;
  expanded?: boolean;
  onToggle?: () => void;
}

function ProductCard({ product, categoryName, expanded, onToggle }: ProductCardProps) {
  const imageUrl = product.imageUrl || (categoryName ? PLACEHOLDER_IMAGES[categoryName] : null);
  const hasDetails = !!(product.description || imageUrl);

  // Example descriptions for demo (user will replace with real ones)
  const demoDescription = !product.description ? getDemoDescription(product.name) : product.description;

  return (
    <div
      className={`bg-gray-800/80 rounded-2xl border border-gray-700/50 overflow-hidden transition-all ${
        hasDetails ? 'cursor-pointer hover:border-gray-600/50' : ''
      }`}
      onClick={hasDetails ? onToggle : undefined}
    >
      {/* Expanded image */}
      {expanded && imageUrl && (
        <div className="h-40 overflow-hidden">
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-base">{product.name}</h3>
            {(expanded || !hasDetails) && demoDescription && (
              <p className="text-gray-400 text-sm mt-1 leading-relaxed">{demoDescription}</p>
            )}
            {!expanded && hasDetails && (
              <p className="text-gray-500 text-xs mt-1">Toca para ver más →</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <span className="text-emerald-400 font-bold text-lg">${product.price.toFixed(0)}</span>
            {imageUrl && !expanded && (
              <div className="w-14 h-14 rounded-xl overflow-hidden mt-2 border border-gray-700">
                <img src={imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== Demo descriptions (user replaces with real content) ====================

function getDemoDescription(productName: string): string {
  const descriptions: Record<string, string> = {
    // Mariscos
    'Camarón al mojo de ajo': 'Camarones frescos salteados en mantequilla con ajo dorado, acompañados de arroz blanco y ensalada',
    'Cóctel de camarón': 'Camarones cocidos en salsa catsup con aguacate, cebolla, cilantro y chile serrano. Servido frío',
    'Filete de pescado empanizado': 'Filete de tilapia crujiente con papas fritas, ensalada y salsa tártara casera',
    'Aguachile rojo': 'Camarón crudo marinado en chile de árbol con pepino, cebolla morada y tostadas',
    'Ceviche de pescado': 'Pescado fresco curado en limón con jitomate, cebolla, cilantro y aguacate',
    'Torre de mariscos': 'Capas de pulpo, camarón, callo de hacha y aguacate con salsa negra',
    'Pescado zarandeado': 'Filete de robalo a las brasas con adobo especial de la casa y guarnición',
    // Bebidas
    'Michelada': 'Cerveza preparada con jugo de limón, clamato, salsa inglesa y chamoy. Vaso escarchado',
    'Agua de horchata': 'Bebida tradicional de arroz con canela y vainilla. Fría y refrescante',
    'Limonada natural': 'Limón recién exprimido con un toque de hierbabuena y hielo',
    'Margarita': 'Tequila, triple sec y limón. Servida en copa escarchada con sal',
    // Entradas
    'Tostadas de ceviche': 'Tres tostadas crujientes con ceviche fresco del día y aguacate',
    'Orden de tacos': 'Tres tacos de camarón empanizado con salsa de mango y coleslaw',
    'Guacamole': 'Aguacate machacado con chile serrano, cebolla, cilantro y jitomate. Con totopos',
  };

  return descriptions[productName] || '';
}
