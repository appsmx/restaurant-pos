import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { useOrderStore } from '../stores/orderStore';

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
  const [sending, setSending] = useState(false);

  // Carrito y Mesa seleccionada (Zustand)
  const { items, addItem, removeItem, clearCart, getTotal, selectedTable } = useOrderStore();

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const data = await apiClient('/menu/categories', 'GET');
      setCategories(data);
      if (data.length > 0) setActiveCategory(data[0].id);
    } catch (err) {
      setError('Error al cargar el menú');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const handleSendToKitchen = async () => {
    if (items.length === 0) return;
    setSending(true);
    try {
      // 1. Crear la orden pasándole la mesa seleccionada
      const order = await apiClient('/orders', 'POST', { 
        type: 'DINE_IN',
        tableId: selectedTable?.id || null 
      });
      
      // 2. Agregar cada item del carrito a la orden
      for (const item of items) {
        await apiClient(`/orders/${order.id}/items`, 'POST', {
          productId: item.id,
          quantity: item.quantity,
        });
      }

      // 3. Enviar a cocina
      await apiClient(`/orders/${order.id}/send`, 'PATCH');

      // 4. Limpiar carrito y mesa
      clearCart();
      alert('¡Orden enviada a cocina correctamente!');
    } catch (err) {
      alert('Error al enviar la orden');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-lg">Cargando menú...</p></div>;
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-red-400 text-lg">{error}</p></div>;

  const selectedCategory = categories.find((c) => c.id === activeCategory);

  return (
    <div className="flex h-full gap-6 relative">
      {/* Sidebar de categorías */}
      <div className="w-56 bg-gray-900 rounded-lg p-4 flex flex-col gap-1">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">Categorías</h2>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`text-left px-3 py-2.5 rounded-md text-sm transition-colors ${
              activeCategory === category.id ? 'bg-blue-600 text-white font-semibold' : 'text-gray-300 hover:bg-gray-800'
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
      <div className="flex-1 overflow-auto pb-24">
        {selectedCategory ? (
          <>
            <h1 className="text-2xl font-bold mb-6">{selectedCategory.name}</h1>
            {selectedCategory.products && selectedCategory.products.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {selectedCategory.products.map((product) => {
                  const cartItem = items.find((i) => i.id === product.id);
                  return (
                    <button
                      key={product.id}
                      onClick={() => addItem({ id: product.id, name: product.name, price: product.price })}
                      className={`bg-gray-800 border rounded-lg p-4 text-left transition-colors group relative ${
                        cartItem ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-700 hover:border-blue-500'
                      }`}
                    >
                      {cartItem && (
                        <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                          {cartItem.quantity}
                        </span>
                      )}
                      <div className="flex-1">
                        <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors">{product.name}</h3>
                        {product.description && <p className="text-gray-500 text-xs mt-1 line-clamp-2">{product.description}</p>}
                      </div>
                      <p className="text-emerald-400 font-bold mt-3">${product.price?.toFixed(2)}</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400"><p>No hay productos en esta categoría</p></div>
            )}
          </>
        ) : (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400"><p>Seleccioná una categoría</p></div>
        )}
      </div>

      {/* Carrito Flotante */}
      {items.length > 0 && (
        <div className="absolute bottom-4 right-4 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4">
          <div className="flex justify-between items-center mb-3 border-b border-gray-800 pb-2">
            <h3 className="text-white font-bold">Ticket Actual</h3>
            {selectedTable && <span className="text-blue-400 text-sm font-semibold">Mesa: {selectedTable.name}</span>}
          </div>
          <div className="space-y-2 max-h-40 overflow-auto mb-3">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm items-center">
                <span className="text-gray-300 flex-1 truncate">{item.name}</span>
                <div className="flex items-center gap-2 ml-2">
                  <button onClick={() => removeItem(item.id)} className="text-gray-500 hover:text-red-400 font-bold">-</button>
                  <span className="text-white w-4 text-center">{item.quantity}</span>
                  <button onClick={() => addItem({ id: item.id, name: item.name, price: item.price })} className="text-gray-500 hover:text-emerald-400 font-bold">+</button>
                  <span className="text-emerald-400 font-medium w-16 text-right">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center font-bold text-lg border-t border-gray-800 pt-2 mb-3">
            <span className="text-gray-300">Total:</span>
            <span className="text-white">${getTotal().toFixed(2)}</span>
          </div>
          <button
            onClick={handleSendToKitchen}
            disabled={sending}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white font-bold py-3 rounded-lg transition-colors"
          >
            {sending ? 'Enviando...' : 'Enviar a Cocina'}
          </button>
        </div>
      )}
    </div>
  );
}