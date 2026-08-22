import { useEffect, useState, useRef } from 'react';
import { apiClient } from '../lib/apiClient';

interface KitchenItem {
  id: string;
  quantity: number;
  notes: string | null;
  status: string;
  product: { name: string; category: { name: string } };
  orderId: string;
}

interface KitchenOrder {
  orderId: string;
  tableName: string | null;
  waiterName: string;
  createdAt: string;
  items: KitchenItem[];
}

function getElapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function getTimeColor(minutes: number): string {
  if (minutes < 10) return 'text-emerald-400';
  if (minutes < 20) return 'text-amber-400';
  return 'text-red-400';
}

function getTimeBg(minutes: number): string {
  if (minutes < 10) return 'bg-emerald-500/10 border-emerald-500/30';
  if (minutes < 20) return 'bg-amber-500/10 border-amber-500/30';
  return 'bg-red-500/10 border-red-500/30';
}

export default function Kitchen() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0); // Force re-render for timers
  const prevCount = useRef(0);

  const fetchQueue = async () => {
    try {
      const data = await apiClient('/kitchen', 'GET');
      // Play sound if new orders arrived
      if (data.length > prevCount.current && prevCount.current > 0) {
        playNotificationSound();
      }
      prevCount.current = data.length;
      setOrders(data);
    } catch (err) {
      console.error('Error fetching kitchen queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // Poll every 10 seconds for new orders
    const interval = setInterval(fetchQueue, 10000);
    // Update timers every 30 seconds
    const timerInterval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => { clearInterval(interval); clearInterval(timerInterval); };
  }, []);

  const handleStartPreparing = async (itemId: string) => {
    try {
      await apiClient(`/kitchen/${itemId}/preparing`, 'PATCH');
      fetchQueue();
    } catch (err) {
      // silently handle
    }
  };

  const handleMarkReady = async (itemId: string) => {
    try {
      await apiClient(`/kitchen/${itemId}/ready`, 'PATCH');
      fetchQueue();
    } catch (err) {
      // silently handle
    }
  };

  const handleMarkOrderReady = async (orderId: string) => {
    try {
      await apiClient(`/kitchen/order/${orderId}/ready`, 'PATCH');
      fetchQueue();
    } catch (err) {
      // silently handle
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-lg">Cargando cocina...</p></div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold">👨‍🍳 Cocina</h1>
          {orders.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
              {orders.length} {orders.length === 1 ? 'orden' : 'órdenes'}
            </span>
          )}
        </div>
        <button
          onClick={fetchQueue}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-gray-300 rounded-lg text-xs md:text-sm transition-colors"
        >
          🔄 Refrescar
        </button>
      </div>

      {/* Empty state */}
      {orders.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-12 text-center text-gray-400">
          <p className="text-5xl mb-3">👨‍🍳</p>
          <p className="text-lg font-medium">Sin pedidos pendientes</p>
          <p className="text-sm mt-1">Los pedidos aparecerán aquí cuando se envíen desde el menú</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {orders.map((order) => {
            const minutes = getElapsedMinutes(order.createdAt);
            const timeColor = getTimeColor(minutes);
            const timeBg = getTimeBg(minutes);
            const allPreparing = order.items.every((i) => i.status === 'PREPARING');

            return (
              <div key={order.orderId} className={`rounded-xl border overflow-hidden ${timeBg}`}>
                {/* Order header */}
                <div className="px-3 md:px-4 py-2.5 border-b border-gray-700/50 flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold text-sm">
                      {order.tableName ? `🍽️ ${order.tableName}` : '📦 Para llevar'}
                    </span>
                    <span className="text-gray-500 text-xs ml-2">· {order.waiterName}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${timeColor}`}>
                    <span className="text-lg">⏱️</span>
                    <span className="font-bold text-sm">{minutes} min</span>
                  </div>
                </div>

                {/* Items */}
                <div className="p-3 md:p-4 space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-medium text-sm">x{item.quantity}</span>
                          <span className="text-white text-sm truncate">{item.product.name}</span>
                        </div>
                        {item.notes && (
                          <p className="text-amber-400 text-xs mt-0.5">📝 {item.notes}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {item.status === 'SENT' ? (
                          <button
                            onClick={() => handleStartPreparing(item.id)}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            🔥 Preparar
                          </button>
                        ) : item.status === 'PREPARING' ? (
                          <button
                            onClick={() => handleMarkReady(item.id)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-medium rounded-lg transition-colors"
                          >
                            ✅ Listo
                          </button>
                        ) : (
                          <span className="text-emerald-400 text-xs font-medium">✓ Listo</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order-level action */}
                <div className="px-3 md:px-4 py-2.5 border-t border-gray-700/50">
                  <button
                    onClick={() => handleMarkOrderReady(order.orderId)}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      allPreparing
                        ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    ✅ Toda la orden lista
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> &lt; 10 min</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 10-20 min</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> &gt; 20 min (urgente)</span>
      </div>
    </div>
  );
}

// ==================== Sound notification ====================

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 500);
  } catch {
    // Audio not available
  }
}
