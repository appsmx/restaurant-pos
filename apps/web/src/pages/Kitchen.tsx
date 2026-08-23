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
  ticketNumber: number;
  orderType: string;
  tableName: string | null;
  waiterName: string;
  createdAt: string;
  items: KitchenItem[];
}

interface CompletedOrder {
  orderId: string;
  ticketNumber: number;
  tableName: string | null;
  status: string;
  completedAt: string;
  items: { quantity: number; name: string }[];
}

type ViewMode = 'active' | 'completed';

function getElapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
}

function getTimeColor(minutes: number): string {
  if (minutes < 10) return 'text-emerald-400';
  if (minutes < 20) return 'text-amber-400';
  return 'text-red-400';
}

function getTimeBg(minutes: number): string {
  if (minutes < 10) return 'bg-gray-800 border-gray-700';
  if (minutes < 20) return 'bg-amber-500/10 border-amber-500/30';
  return 'bg-red-500/10 border-red-500/30';
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'SENT': return { label: 'Nuevo', color: 'bg-blue-500/20 text-blue-400' };
    case 'PREPARING': return { label: 'Preparando', color: 'bg-orange-500/20 text-orange-400' };
    default: return { label: status, color: 'bg-gray-500/20 text-gray-400' };
  }
}

export default function Kitchen() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [completed, setCompleted] = useState<CompletedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [, setTick] = useState(0);
  const prevCount = useRef(0);

  const fetchQueue = async () => {
    try {
      const data = await apiClient('/kitchen', 'GET');
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

  const fetchCompleted = async () => {
    try {
      const data = await apiClient('/kitchen/completed', 'GET');
      setCompleted(data);
    } catch {
      // optional
    }
  };

  useEffect(() => {
    fetchQueue();
    fetchCompleted();
    const interval = setInterval(() => { fetchQueue(); fetchCompleted(); }, 10000);
    const timerInterval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => { clearInterval(interval); clearInterval(timerInterval); };
  }, []);

  const handleStartPreparing = async (itemId: string) => {
    try {
      await apiClient(`/kitchen/${itemId}/preparing`, 'PATCH');
      fetchQueue();
    } catch {}
  };

  const handleMarkReady = async (itemId: string) => {
    try {
      await apiClient(`/kitchen/${itemId}/ready`, 'PATCH');
      fetchQueue();
      fetchCompleted();
    } catch {}
  };

  const handleMarkOrderReady = async (orderId: string) => {
    try {
      await apiClient(`/kitchen/order/${orderId}/ready`, 'PATCH');
      fetchQueue();
      fetchCompleted();
    } catch {}
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-lg">Cargando cocina...</p></div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold">👨‍🍳 Cocina</h1>
          {orders.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
              {orders.length} {orders.length === 1 ? 'orden' : 'órdenes'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('active')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'active' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              🔥 Pendientes ({orders.length})
            </button>
            <button
              onClick={() => setViewMode('completed')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'completed' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              ✅ Completadas ({completed.length})
            </button>
          </div>
          <button
            onClick={() => { fetchQueue(); fetchCompleted(); }}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors"
          >
            🔄
          </button>
        </div>
      </div>

      {/* ==================== ACTIVE ORDERS VIEW ==================== */}
      {viewMode === 'active' && (
        <>
          {orders.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-12 text-center text-gray-400">
              <p className="text-5xl mb-3">👨‍🍳</p>
              <p className="text-lg font-medium">Sin pedidos pendientes</p>
              <p className="text-sm mt-1">Los pedidos aparecerán aquí cuando se envíen desde el menú</p>
              <p className="text-xs text-gray-600 mt-3">Se actualiza automáticamente cada 10 segundos</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {orders.map((order) => {
                const minutes = getElapsedMinutes(order.createdAt);
                const timeColor = getTimeColor(minutes);
                const timeBg = getTimeBg(minutes);
                const allPreparing = order.items.every((i) => i.status === 'PREPARING');
                const itemsSent = order.items.filter((i) => i.status === 'SENT').length;
                const itemsPreparing = order.items.filter((i) => i.status === 'PREPARING').length;

                return (
                  <div key={order.orderId} className={`rounded-xl border overflow-hidden ${timeBg}`}>
                    {/* Order header */}
                    <div className="px-3 md:px-4 py-2.5 border-b border-gray-700/50">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-gray-700 text-white font-mono font-bold text-xs px-2 py-0.5 rounded">
                            #{order.ticketNumber}
                          </span>
                          <span className="text-white font-bold text-sm">
                            {order.tableName ? `🍽️ ${order.tableName}` : '📦 Para llevar'}
                          </span>
                        </div>
                        <div className={`flex items-center gap-1 ${timeColor}`}>
                          <span className="font-bold text-sm">{minutes}m</span>
                          {minutes >= 20 && <span className="text-base animate-pulse">🚨</span>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-xs">👤 {order.waiterName}</span>
                        <div className="flex gap-1.5">
                          {itemsSent > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                              {itemsSent} nuevos
                            </span>
                          )}
                          {itemsPreparing > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">
                              {itemsPreparing} preparando
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="p-3 md:p-4 space-y-2">
                      {order.items.map((item) => {
                        const badge = getStatusBadge(item.status);
                        return (
                          <div key={item.id} className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="bg-white/10 text-white font-bold text-xs w-6 h-6 rounded flex items-center justify-center shrink-0">
                                  {item.quantity}
                                </span>
                                <span className="text-white text-sm font-medium truncate">{item.product.name}</span>
                              </div>
                              {item.notes && (
                                <p className="text-amber-400 text-xs mt-0.5 ml-8">⚠️ {item.notes}</p>
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
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-medium rounded-lg transition-colors animate-pulse"
                                >
                                  ✅ Listo
                                </button>
                              ) : (
                                <span className="text-emerald-400 text-xs font-medium">✓ Listo</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
            <span className="text-gray-600">· Se actualiza cada 10s</span>
          </div>
        </>
      )}

      {/* ==================== COMPLETED ORDERS VIEW ==================== */}
      {viewMode === 'completed' && (
        <>
          {completed.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
              <p className="text-3xl mb-2">✅</p>
              <p>No hay órdenes completadas en la última hora</p>
            </div>
          ) : (
            <div className="space-y-2">
              {completed.map((order) => (
                <div key={order.orderId} className="bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs px-2 py-1 rounded">
                      #{order.ticketNumber}
                    </span>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {order.tableName ? `🍽️ ${order.tableName}` : '📦 Para llevar'}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      order.status === 'READY' ? 'bg-emerald-500/20 text-emerald-400' :
                      order.status === 'CLOSED' ? 'bg-gray-500/20 text-gray-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {order.status === 'READY' ? '✅ Lista' : order.status === 'CLOSED' ? '💰 Cobrada' : '🍽️ Servida'}
                    </span>
                    <p className="text-gray-600 text-xs mt-1">{formatTime(order.completedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
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
