import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

interface DrilldownOrder {
  id: string;
  ticketNumber: number;
  total: number;
  closedAt: string;
  table: { name: string } | null;
  user: { name: string };
  closedBy: { name: string } | null;
  items: { quantity: number; product: { name: string } }[];
  payments: { method: string; amount: number; tip: number }[];
}

interface DrilldownResult {
  orders: DrilldownOrder[];
  summary: { count: number; totalSales: number };
}

export interface DrilldownFilters {
  title: string;
  date?: string;
  productId?: string;
  employeeId?: string;
  paymentMethod?: string;
  period?: string;
  role?: 'creator' | 'cashier';
}

const METHOD_LABELS: Record<string, string> = {
  CASH: '💵 Efectivo',
  CARD: '💳 Tarjeta',
  TRANSFER: '📲 Transferencia',
  OTHER: '🔄 Otro',
};

interface Props {
  filters: DrilldownFilters;
  onClose: () => void;
}

export default function DrilldownModal({ filters, onClose }: Props) {
  const [data, setData] = useState<DrilldownResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDrilldown = async () => {
      try {
        const params = new URLSearchParams();
        if (filters.date) params.set('date', filters.date);
        if (filters.productId) params.set('productId', filters.productId);
        if (filters.employeeId) params.set('employeeId', filters.employeeId);
        if (filters.paymentMethod) params.set('paymentMethod', filters.paymentMethod);
        if (filters.period) params.set('period', filters.period);
        if (filters.role) params.set('role', filters.role);

        const result = await apiClient(`/reports/drilldown?${params.toString()}`, 'GET');
        setData(result);
      } catch {
        setData({ orders: [], summary: { count: 0, totalSales: 0 } });
      } finally {
        setLoading(false);
      }
    };
    fetchDrilldown();
  }, [filters]);

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('es-MX', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-900 rounded-2xl w-full max-w-2xl border border-gray-700 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">🔍 {filters.title}</h2>
            {data && !loading && (
              <p className="text-gray-400 text-sm mt-0.5">
                {data.summary.count} órdenes — <span className="text-emerald-400 font-medium">${data.summary.totalSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl p-1">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <p className="text-gray-400 text-center py-8">Cargando órdenes...</p>
          ) : !data || data.orders.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No se encontraron órdenes con estos filtros</p>
          ) : (
            <div className="space-y-2">
              {data.orders.map((order) => (
                <div key={order.id} className="bg-gray-800 rounded-xl border border-gray-700 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="bg-gray-700 text-white font-mono text-xs px-2 py-0.5 rounded">
                        #{order.ticketNumber}
                      </span>
                      <span className="text-white text-sm font-medium">
                        {order.table ? `🍽️ ${order.table.name}` : '📦 Para llevar'}
                      </span>
                    </div>
                    <span className="text-emerald-400 font-bold text-sm">${order.total.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-1.5">
                    <span>👤 {order.user.name}</span>
                    {order.closedBy && order.closedBy.name !== order.user.name && (
                      <span>💰 {order.closedBy.name}</span>
                    )}
                    <span>🕐 {formatTime(order.closedAt)}</span>
                    {order.payments[0] && (
                      <span>{METHOD_LABELS[order.payments[0].method] || order.payments[0].method}</span>
                    )}
                  </div>

                  <p className="text-gray-400 text-xs truncate">
                    {order.items.map((i) => `${i.quantity}x ${i.product.name}`).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
