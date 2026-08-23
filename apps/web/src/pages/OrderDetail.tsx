import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

// ==================== INTERFACES ====================

interface OrderEvent {
  id: string;
  action: string;
  details: string | null;
  userId: string;
  userName: string;
  createdAt: string;
}

interface OrderItemDetail {
  id: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  status: string;
  product: { name: string; price: number };
}

interface PaymentDetail {
  method: string;
  amount: number;
  tip: number;
  createdAt: string;
  user: { name: string };
}

interface OrderFull {
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
  items: OrderItemDetail[];
  payments: PaymentDetail[];
  events: OrderEvent[];
}

// ==================== EVENT CONFIG ====================

const EVENT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  CREATED: { icon: '🆕', color: 'border-blue-500', label: 'Orden creada' },
  ITEM_ADDED: { icon: '➕', color: 'border-emerald-500', label: 'Producto agregado' },
  SENT_TO_KITCHEN: { icon: '🔥', color: 'border-orange-500', label: 'Enviado a cocina' },
  ITEM_PREPARING: { icon: '👨‍🍳', color: 'border-amber-500', label: 'Preparando' },
  ITEM_READY: { icon: '✅', color: 'border-emerald-500', label: 'Listo' },
  ORDER_READY: { icon: '🍽️', color: 'border-green-500', label: 'Orden completa' },
  PAID: { icon: '💰', color: 'border-purple-500', label: 'Cobrado' },
  CANCELLED: { icon: '❌', color: 'border-red-500', label: 'Cancelado' },
};

const METHOD_LABELS: Record<string, string> = {
  CASH: '💵 Efectivo',
  CARD: '💳 Tarjeta',
  TRANSFER: '📲 Transferencia',
  OTHER: '🔄 Otro',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Abierta', color: 'bg-yellow-500/20 text-yellow-400' },
  SENT: { label: 'En cocina', color: 'bg-orange-500/20 text-orange-400' },
  PREPARING: { label: 'Preparando', color: 'bg-blue-500/20 text-blue-400' },
  READY: { label: 'Lista', color: 'bg-emerald-500/20 text-emerald-400' },
  CLOSED: { label: 'Cerrada', color: 'bg-gray-500/20 text-gray-400' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-500/20 text-red-400' },
};

// ==================== COMPONENT ====================

interface OrderDetailProps {
  orderId: string;
  onBack: () => void;
}

export default function OrderDetail({ orderId, onBack }: OrderDetailProps) {
  const [order, setOrder] = useState<OrderFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const data = await apiClient(`/orders/${orderId}`, 'GET');
        setOrder(data);
      } catch (err) {
        setError('Error al cargar el detalle de la orden');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Cargando detalle...</p></div>;
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-red-400">{error}</p></div>;
  if (!order) return null;

  const statusConfig = STATUS_LABELS[order.status] || STATUS_LABELS.CLOSED;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-xl transition-colors">
          ← Volver
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold">Orden #{order.ticketNumber}</h1>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">
            {order.table ? `🍽️ ${order.table.name}` : '📦 Para llevar'} · {formatDateTime(order.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        {/* ==================== LEFT: Order info ==================== */}
        <div className="lg:col-span-5 space-y-4">
          {/* People involved */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h2 className="text-white font-semibold text-sm mb-3">👥 Personal involucrado</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">🍽️ Creó la orden:</span>
                <span className="text-white text-sm font-medium">{order.user.name} <span className="text-gray-500 text-xs">({order.user.role})</span></span>
              </div>
              {order.closedBy && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">💰 Cobró:</span>
                  <span className="text-white text-sm font-medium">{order.closedBy.name} <span className="text-gray-500 text-xs">({order.closedBy.role})</span></span>
                </div>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h2 className="text-white font-semibold text-sm mb-3">⏱️ Tiempos</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Creada:</span>
                <span className="text-white text-xs font-mono">{formatDateTime(order.createdAt)}</span>
              </div>
              {order.sentAt && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Enviada a cocina:</span>
                  <span className="text-white text-xs font-mono">{formatDateTime(order.sentAt)}</span>
                </div>
              )}
              {order.closedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Cobrada:</span>
                  <span className="text-white text-xs font-mono">{formatDateTime(order.closedAt)}</span>
                </div>
              )}
              {order.sentAt && order.closedAt && (
                <div className="flex items-center justify-between pt-1 border-t border-gray-700">
                  <span className="text-gray-400 text-xs">Tiempo total:</span>
                  <span className="text-amber-400 text-xs font-bold">
                    {Math.round((new Date(order.closedAt).getTime() - new Date(order.createdAt).getTime()) / 60000)} min
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h2 className="text-white font-semibold text-sm mb-3">🧾 Productos ({order.items.length})</h2>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-sm">{item.quantity}x {item.product.name}</span>
                    {item.notes && <span className="text-amber-400 text-xs ml-2">({item.notes})</span>}
                  </div>
                  <span className="text-gray-400 text-sm font-mono ml-2">${(item.unitPrice * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-gray-700 pt-2 mt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subtotal:</span>
                  <span className="text-white">${(order.subtotal || order.total + order.discount).toFixed(2)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-400">
                      🏷️ Descuento {order.discountType === 'PERCENT' ? `(%)` : '($)'}:
                    </span>
                    <span className="text-amber-400">-${order.discount.toFixed(2)}</span>
                  </div>
                )}
                {order.discountReason && (
                  <p className="text-gray-500 text-xs italic">Razón: {order.discountReason}</p>
                )}
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-white">Total:</span>
                  <span className="text-emerald-400">${order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment info */}
          {order.payments.length > 0 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <h2 className="text-white font-semibold text-sm mb-3">💳 Pago</h2>
              {order.payments.map((p, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">{METHOD_LABELS[p.method] || p.method}</span>
                    <div className="text-right">
                      <span className="text-emerald-400 font-bold text-sm">${p.amount.toFixed(2)}</span>
                      <p className="text-gray-600 text-xs">{formatTime(p.createdAt)} · {p.user.name}</p>
                    </div>
                  </div>
                  {p.tip > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-pink-400 text-sm">💝 Propina</span>
                      <span className="text-pink-400 font-bold text-sm">${p.tip.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ==================== RIGHT: Timeline ==================== */}
        <div className="lg:col-span-7">
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700">
              <h2 className="text-white font-semibold text-sm md:text-base">📜 Timeline de la orden</h2>
              <p className="text-gray-500 text-xs mt-0.5">Registro cronológico de todo lo que pasó con esta orden</p>
            </div>

            {order.events.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm">No hay eventos registrados para esta orden</p>
                <p className="text-gray-600 text-xs mt-1">Los eventos se registran automáticamente a partir de ahora</p>
              </div>
            ) : (
              <div className="p-4">
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-700" />

                  {/* Events */}
                  <div className="space-y-4">
                    {order.events.map((event) => {
                      const config = EVENT_CONFIG[event.action] || { icon: '📌', color: 'border-gray-500', label: event.action };
                      return (
                        <div key={event.id} className="relative flex items-start gap-3 pl-1">
                          {/* Dot */}
                          <div className={`w-[30px] h-[30px] rounded-full bg-gray-900 border-2 ${config.color} flex items-center justify-center text-sm shrink-0 z-10`}>
                            {config.icon}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-white text-sm font-medium">{config.label}</span>
                              <span className="text-gray-500 text-xs font-mono shrink-0">
                                {formatTime(event.createdAt)}
                              </span>
                            </div>
                            {event.details && (
                              <p className="text-gray-400 text-xs mt-0.5">{event.details}</p>
                            )}
                            <p className="text-gray-600 text-xs mt-0.5">
                              👤 {event.userName}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
