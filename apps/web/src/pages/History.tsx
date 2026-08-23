import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import OrderDetail from './OrderDetail';

interface OrderHistoryItem {
  id: string;
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

const METHOD_ICONS: Record<string, string> = {
  CASH: '💵',
  CARD: '💳',
  TRANSFER: '📲',
  OTHER: '🔄',
};

export default function History() {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 15, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

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
      setError('Error al cargar el historial. Verifica que tengas permisos de administrador.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(1);
  }, []);

  const handleFilter = () => {
    fetchHistory(1);
  };

  const handleClearFilters = () => {
    setFromDate('');
    setToDate('');
    setTimeout(() => fetchHistory(1), 0);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      {/* Show OrderDetail if an order is selected */}
      {selectedOrderId ? (
        <OrderDetail orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />
      ) : (
      <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h1 className="text-xl md:text-2xl font-bold">📜 Historial de Ventas</h1>
        <div className="flex items-center gap-2">
          <a
            href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/reports/export?period=custom${fromDate ? `&from=${fromDate}` : ''}${toDate ? `&to=${toDate}` : ''}`}
            target="_blank"
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-xl transition-colors"
          >
            📥 Exportar Excel
          </a>
          <span className="text-gray-500 text-xs md:text-sm">
            {pagination.total} {pagination.total === 1 ? 'orden' : 'órdenes'} encontradas
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-3 md:p-4 mb-4 md:mb-5">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full sm:w-auto">
            <label className="text-gray-400 text-xs mb-1 block">Desde</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex-1 w-full sm:w-auto">
            <label className="text-gray-400 text-xs mb-1 block">Hasta</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-gray-700 text-white text-sm rounded-lg border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleFilter}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              🔍 Filtrar
            </button>
            {(fromDate || toDate) && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
              >
                ✕
              </button>
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
          <p>No hay órdenes cerradas {(fromDate || toDate) ? 'en ese rango de fechas' : 'todavía'}</p>
        </div>
      ) : (
        <>
          {/* Orders list */}
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} onClick={() => setSelectedOrderId(order.id)} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden cursor-pointer hover:border-blue-500/50 transition-colors">
                {/* Order header */}
                <div className="px-3 md:px-4 py-2.5 flex items-center justify-between border-b border-gray-700/50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {order.table ? `🍽️ ${order.table.name}` : '📦 Para llevar'}
                    </span>
                    <span className="text-gray-500 text-xs">·</span>
                    <span className="text-gray-400 text-xs">🍽️ {order.user.name}</span>
                    {order.closedBy && order.closedBy.name !== order.user.name && (
                      <>
                        <span className="text-gray-600 text-xs">·</span>
                        <span className="text-blue-400 text-xs">💰 {order.closedBy.name}</span>
                      </>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold text-sm md:text-base">
                      ${order.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Order details */}
                <div className="px-3 md:px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  {/* Items summary */}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-400 text-xs truncate">
                      {order.items.map((item) => `${item.quantity}x ${item.product.name}`).join(', ')}
                    </p>
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center gap-3 shrink-0">
                    {order.payments.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {METHOD_ICONS[order.payments[0].method] || '💰'} {order.payments[0].method}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      📅 {formatDate(order.closedAt)}
                    </span>
                    <span className="text-xs text-gray-500">
                      🕐 {formatTime(order.closedAt)}
                    </span>
                    <span className="text-xs text-blue-400 hidden sm:inline">
                      Ver detalle →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={() => fetchHistory(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-gray-400 text-sm px-3">
                Página {pagination.page} de {pagination.pages}
              </span>
              <button
                onClick={() => fetchHistory(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
      </>
      )}
    </div>
  );
}
