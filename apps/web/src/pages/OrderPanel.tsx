import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
  status: string;
  product: {
    name: string;
    price: number;
  };
}

interface Order {
  id: string;
  type: string;
  status: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
  table: { name: string } | null;
  user: { name: string };
}

const STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  OPEN: { label: 'Abierta', bg: 'bg-yellow-600' },
  SENT: { label: 'Enviada', bg: 'bg-orange-600' },
  PREPARING: { label: 'Preparando', bg: 'bg-blue-600' },
  READY: { label: 'Lista', bg: 'bg-emerald-600' },
};

export default function OrderPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await apiClient('/orders/active', 'GET');
      setOrders(data);
    } catch (err) {
      setError('Error al cargar las órdenes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Opcional: refrescar cada 30 segundos
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-lg">Cargando órdenes...</p>
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Órdenes Activas</h1>
        <button 
          onClick={fetchOrders} 
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
        >
          Refrescar
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
          <p className="text-4xl mb-2">兴隆</p>
          <p>No hay órdenes activas actualmente</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => {
            const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.OPEN;
            return (
              <div key={order.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                {/* Cabecera de la orden */}
                <div className={`px-4 py-2 ${config.bg} flex items-center justify-between`}>
                  <span className="text-white font-bold text-sm">
                    {order.table ? `Mesa: ${order.table.name}` : 'Para llevar'}
                  </span>
                  <span className="bg-black/20 text-white text-xs px-2 py-0.5 rounded-full">
                    {config.label}
                  </span>
                </div>

                {/* Lista de items */}
                <div className="p-4 space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <div className="text-gray-300">
                        <span className="text-gray-500 mr-1">x{item.quantity}</span>
                        {item.product.name}
                        {item.notes && <span className="text-blue-400 ml-1">*{item.notes}</span>}
                      </div>
                      <span className="text-gray-400">
                        ${(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Pie de la orden */}
                <div className="px-4 py-3 border-t border-gray-700 flex justify-between items-center">
                  <span className="text-gray-500 text-xs">
                    Mesero: {order.user.name}
                  </span>
                  <span className="text-white font-bold">
                    Total: ${order.total?.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}