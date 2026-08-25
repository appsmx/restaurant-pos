import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

interface OrderHistoryItem {
  id: string;
  ticketNumber?: number;
  total: number;
  type: string;
  closedAt: string;
  table: { name: string } | null;
  user: { name: string };
  closedBy: { name: string } | null;
  items: { quantity: number; product: { name: string } }[];
  payments: { method: string; amount: number }[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface OrderDetailData {
  id: string;
  ticketNumber: number;
  type: string;
  status: string;
  total: number;
  subtotal: number;
  discount: number;
  discountType: string | null;
  discountReason: string | null;
  createdAt: string;
  sentAt: string | null;
  closedAt: string | null;
  table: { name: string } | null;
  user: { id: string; name: string; role: string };
  closedBy: { id: string; name: string; role: string } | null;
  items: { id: string; quantity: number; unitPrice: number; notes: string | null; product: { name: string }; modifiers?: { id: string; name: string; price: number; quantity: number }[] }[];
  payments: { method: string; amount: number; tip: number; createdAt: string; user?: { name: string } }[];
  events: { id: string; action: string; details: string | null; userName: string; createdAt: string }[];
}

const METHOD_ICONS: Record<string, string> = {
  CASH: '💵',
  CARD: '💳',
  TRANSFER: '📲',
  OTHER: '🔄',
};

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

const EVENT_ICONS: Record<string, string> = {
  CREATED: '🆕',
  ITEM_ADDED: '➕',
  SENT_TO_KITCHEN: '🔥',
  ITEM_PREPARING: '👨‍🍳',
  ITEM_READY: '✅',
  ORDER_READY: '🍽️',
  PAID: '💰',
};

export default function History() {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 15, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Detail view
  const [detail, setDetail] = useState<OrderDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  const fetchHistory = async (page: number = 1) => {
    try {
      setLoading(true);
      setError('');
      let url = `/reports/history?page=${page}&limit=15`;
      if (fromDate) url += `&from=${fromDate}`;
      if (toDate) url += `&to=${toDate}`;
      const data = await apiClient(url, 'GET');
      setOrders(data.orders);
      setPagination(data.pagination);
    } catch (err) {
      setError('Error al cargar el historial.');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (orderId: string) => {
    setLoadingDetail(true);
    setDetailError('');
    try {
      const data = await apiClient(`/reports/order/${orderId}`, 'GET');
      setDetail(data);
    } catch (err) {
      setDetailError('No se pudo cargar el detalle. El servidor puede estar procesando.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setDetailError('');
  };

  const handleReopenOrder = async () => {
    if (!detail) return;
    if (!confirm('⚠️ ¿Reabrir esta orden? Se eliminarán los pagos registrados y la orden volverá a aparecer en Órdenes Activas.')) return;
    try {
      await apiClient(`/orders/${detail.id}/reopen`, 'PATCH');
      alert('✅ Orden reabierta');
      closeDetail();
      fetchHistory(pagination.page);
    } catch (err: any) {
      alert(err.message || 'Error al reabrir la orden');
    }
  };

  useEffect(() => { fetchHistory(1); }, []);

  const handleFilter = () => fetchHistory(1);
  const handleClearFilters = () => { setFromDate(''); setToDate(''); setTimeout(() => fetchHistory(1), 0); };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const formatFullTime = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // ==================== DETAIL VIEW ====================
  if (detail) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={closeDetail} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-xl">← Volver</button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Orden #{detail.ticketNumber}</h1>
            <p className="text-gray-500 text-xs">{detail.table ? `🍽️ ${detail.table.name}` : '📦 Para llevar'} · {formatDate(detail.createdAt)}</p>
          </div>
          {detail.status === 'CLOSED' && (
            <button
              onClick={handleReopenOrder}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-xl transition-colors shrink-0"
            >
              🔄 Reabrir orden
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Info */}
          <div className="space-y-4">
            {/* People */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h2 className="text-white font-semibold text-sm mb-2">👥 Personal</h2>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Creó la orden:</span><span className="text-white">{detail.user.name}</span></div>
                {detail.closedBy && <div className="flex justify-between"><span className="text-gray-400">Cobró:</span><span className="text-white">{detail.closedBy.name}</span></div>}
              </div>
            </div>

            {/* Times */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h2 className="text-white font-semibold text-sm mb-2">⏱️ Tiempos</h2>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-400">Creada:</span><span className="text-white font-mono">{formatDate(detail.createdAt)} {formatFullTime(detail.createdAt)}</span></div>
                {detail.sentAt && <div className="flex justify-between"><span className="text-gray-400">A cocina:</span><span className="text-white font-mono">{formatFullTime(detail.sentAt)}</span></div>}
                {detail.closedAt && <div className="flex justify-between"><span className="text-gray-400">Cobrada:</span><span className="text-white font-mono">{formatFullTime(detail.closedAt)}</span></div>}
                {detail.closedAt && (
                  <div className="flex justify-between pt-1 border-t border-gray-700">
                    <span className="text-gray-400">Tiempo total:</span>
                    <span className="text-amber-400 font-bold">{Math.round((new Date(detail.closedAt).getTime() - new Date(detail.createdAt).getTime()) / 60000)} min</span>
                  </div>
                )}
              </div>
            </div>

            {/* Items + totals */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h2 className="text-white font-semibold text-sm mb-2">🧾 Productos</h2>
              <div className="space-y-1 text-sm">
                {detail.items.map((item) => (
                  <div key={item.id}>
                    <div className="flex justify-between">
                      <span className="text-white">{item.quantity}x {item.product.name}</span>
                      <span className="text-gray-400 font-mono">${(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </div>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="ml-5 space-y-0">
                        {item.modifiers.map((mod) => (
                          <p key={mod.id} className="text-cyan-400 text-xs">
                            🧩 {mod.name}{mod.price > 0 ? ` (+$${mod.price.toFixed(2)})` : ''}
                          </p>
                        ))}
                      </div>
                    )}
                    {item.notes && <p className="text-amber-400 text-xs ml-5">📝 {item.notes}</p>}
                  </div>
                ))}
                <div className="border-t border-gray-700 pt-2 mt-2">
                  {detail.discount > 0 && (
                    <div className="flex justify-between text-amber-400 text-sm">
                      <span>🏷️ Descuento:</span><span>-${detail.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-white font-bold">
                    <span>Total:</span><span className="text-emerald-400">${detail.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment */}
            {detail.payments.length > 0 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <h2 className="text-white font-semibold text-sm mb-2">💳 Pagos</h2>
                {detail.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-400">{METHOD_LABELS[p.method] || p.method}</span>
                    <span className="text-emerald-400 font-bold">${p.amount.toFixed(2)}{p.tip > 0 ? ` + $${p.tip.toFixed(2)} propina` : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Timeline */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700">
              <h2 className="text-white font-semibold text-sm">📜 Timeline</h2>
            </div>
            {detail.events.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                <p>Sin eventos registrados para esta orden</p>
                <p className="text-xs mt-1">Las órdenes nuevas tendrán timeline automático</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {detail.events.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-3">
                    <span className="text-lg shrink-0">{EVENT_ICONS[ev.action] || '📌'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-medium">{ev.action.replace(/_/g, ' ')}</span>
                        <span className="text-gray-500 text-xs font-mono">{formatFullTime(ev.createdAt)}</span>
                      </div>
                      {ev.details && <p className="text-gray-400 text-xs mt-0.5">{ev.details}</p>}
                      <p className="text-gray-600 text-xs">👤 {ev.userName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== DETAIL LOADING/ERROR ====================
  if (loadingDetail) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Cargando detalle...</p></div>;
  }
  if (detailError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-400">{detailError}</p>
        <button onClick={closeDetail} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-xl">← Volver al historial</button>
      </div>
    );
  }

  // ==================== MAIN LIST VIEW ====================
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h1 className="text-xl md:text-2xl font-bold">📜 Historial de Ventas</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const token = localStorage.getItem('pos_token');
              const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';
              window.open(`${apiUrl}/reports/export?period=custom${fromDate ? `&from=${fromDate}` : ''}${toDate ? `&to=${toDate}` : ''}&token=${token}`, '_blank');
            }}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-xl transition-colors"
          >
            📥 Exportar Excel
          </button>
          <span className="text-gray-500 text-xs md:text-sm">
            {pagination.total} {pagination.total === 1 ? 'orden' : 'órdenes'}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-3 md:p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full sm:w-auto">
            <label className="text-gray-400 text-xs mb-1 block">Desde</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="flex-1 w-full sm:w-auto">
            <label className="text-gray-400 text-xs mb-1 block">Hasta</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={handleFilter} className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg">🔍 Filtrar</button>
            {(fromDate || toDate) && (
              <button onClick={handleClearFilters} className="px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg">✕</button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><p className="text-gray-400">Cargando...</p></div>
      ) : error ? (
        <div className="flex items-center justify-center h-40"><p className="text-red-400 text-center px-4">{error}</p></div>
      ) : orders.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
          <p className="text-3xl mb-2">📭</p>
          <p>No hay órdenes cerradas {(fromDate || toDate) ? 'en ese rango' : 'todavía'}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} onClick={() => openDetail(order.id)} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden cursor-pointer hover:border-blue-500/50 transition-colors">
                <div className="px-3 md:px-4 py-2.5 flex items-center justify-between border-b border-gray-700/50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {order.table ? `🍽️ ${order.table.name}` : '📦 Para llevar'}
                    </span>
                    <span className="text-gray-500 text-xs">·</span>
                    <span className="text-gray-400 text-xs">👤 {order.user.name}</span>
                    {order.closedBy && order.closedBy.name !== order.user.name && (
                      <span className="text-blue-400 text-xs">· 💰 {order.closedBy.name}</span>
                    )}
                  </div>
                  <span className="text-emerald-400 font-bold text-sm">${order.total.toFixed(2)}</span>
                </div>
                <div className="px-3 md:px-4 py-2.5 flex items-center justify-between gap-2">
                  <p className="text-gray-400 text-xs truncate flex-1">
                    {order.items.map((i) => `${i.quantity}x ${i.product.name}`).join(', ')}
                  </p>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-gray-500">
                    {order.payments[0] && (
                      <span className="text-gray-400">
                        {METHOD_ICONS[order.payments[0].method]} {METHOD_LABELS[order.payments[0].method] || order.payments[0].method}
                      </span>
                    )}
                    <span>{formatDate(order.closedAt)}</span>
                    <span>{formatTime(order.closedAt)}</span>
                    <span className="text-blue-400 hidden sm:inline">→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => fetchHistory(pagination.page - 1)} disabled={pagination.page <= 1}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white text-sm rounded-lg">← Anterior</button>
              <span className="text-gray-400 text-sm px-3">Pág {pagination.page}/{pagination.pages}</span>
              <button onClick={() => fetchHistory(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white text-sm rounded-lg">Siguiente →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
