import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { printTicket } from '../lib/printTicket';

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
  status: string;
  product: { name: string; price: number };
}

interface Order {
  id: string;
  ticketNumber: number;
  type: string;
  status: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
  table: { name: string } | null;
  user: { name: string };
}

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

const STATUS_CONFIG: Record<string, { label: string; bg: string }> = {
  OPEN: { label: 'Abierta', bg: 'bg-yellow-600' },
  SENT: { label: 'Enviada', bg: 'bg-orange-600' },
  PREPARING: { label: 'Preparando', bg: 'bg-blue-600' },
  READY: { label: 'Lista', bg: 'bg-emerald-600' },
};

const PAYMENT_METHODS: { method: PaymentMethod; label: string; icon: string; color: string }[] = [
  { method: 'CASH', label: 'Efectivo', icon: '💵', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-400' },
  { method: 'CARD', label: 'Tarjeta', icon: '💳', color: 'border-blue-500 bg-blue-500/10 text-blue-400' },
  { method: 'TRANSFER', label: 'Transferencia', icon: '📲', color: 'border-purple-500 bg-purple-500/10 text-purple-400' },
  { method: 'OTHER', label: 'Otro', icon: '🔄', color: 'border-gray-500 bg-gray-500/10 text-gray-400' },
];

export default function OrderPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payModal, setPayModal] = useState<Order | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('CASH');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<{ id: string; firstName: string; lastName: string; loyaltyPoints: number }[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);

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
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const openPayModal = (order: Order) => {
    setPayModal(order);
    setSelectedMethod('CASH');
    setSelectedCustomer(null);
    setCustomerSearch('');
    setCustomerResults([]);
  };

  const searchCustomers = async (query: string) => {
    setCustomerSearch(query);
    if (query.length < 2) { setCustomerResults([]); return; }
    try {
      const results = await apiClient(`/customers?search=${encodeURIComponent(query)}`, 'GET');
      setCustomerResults(results.slice(0, 5));
    } catch { setCustomerResults([]); }
  };

  const handleConfirmPay = async () => {
    if (!payModal) return;
    const orderToPay = payModal;

    setPayingId(payModal.id);
    setPayModal(null);
    try {
      await apiClient(`/orders/${orderToPay.id}/pay`, 'PATCH', {
        method: selectedMethod,
        customerId: selectedCustomer?.id || null,
      });

      // Ofrecer imprimir ticket
      const shouldPrint = confirm('✅ Cobro exitoso. ¿Imprimir ticket?');
      if (shouldPrint) {
        try {
          const config = await apiClient('/config', 'GET');
          const subtotal = orderToPay.total;
          const taxRate = config.taxRate || 0.16;
          const tax = subtotal * taxRate;
          const total = subtotal + tax;

          printTicket({
            ticketNumber: orderToPay.ticketNumber || 0,
            date: new Date().toLocaleDateString('es-MX'),
            waiterName: orderToPay.user?.name || 'N/A',
            tableName: orderToPay.table?.name || null,
            items: orderToPay.items.map((i) => ({
              name: i.product.name,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
            subtotal,
            taxRate,
            tax,
            total,
            paymentMethod: selectedMethod,
            restaurant: {
              name: config.name,
              address: config.address,
              phone: config.phone,
              rfc: config.rfc,
            },
          });
        } catch { /* silently fail print */ }
      }

      fetchOrders();
    } catch (err) {
      alert('Error al procesar el pago');
    } finally {
      setPayingId(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-lg">Cargando órdenes...</p></div>;
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-red-400 text-lg">{error}</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Órdenes Activas</h1>
        <button onClick={fetchOrders} className="px-3 py-2 md:px-4 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-gray-300 rounded-lg text-xs md:text-sm transition-colors">
          🔄 Refrescar
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
          <p className="text-4xl mb-2">🧾</p>
          <p>No hay órdenes activas actualmente</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {orders.map((order) => {
            const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.OPEN;
            const isPaying = payingId === order.id;
            
            return (
              <div key={order.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
                {/* Cabecera */}
                <div className={`px-3 md:px-4 py-2.5 ${config.bg} flex items-center justify-between`}>
                  <span className="text-white font-bold text-sm">
                    {order.table ? `🍽️ ${order.table.name}` : '📦 Para llevar'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/70 text-xs font-mono">#{order.ticketNumber || '—'}</span>
                    <span className="bg-black/20 text-white text-xs px-2 py-0.5 rounded-full">
                      {config.label}
                    </span>
                  </div>
                </div>

                {/* Lista de items */}
                <div className="p-3 md:p-4 space-y-2 flex-1">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <div className="text-gray-300 flex-1">
                        <span className="text-gray-500 mr-1">x{item.quantity}</span>
                        <span className="line-clamp-1">{item.product.name}</span>
                        {item.notes && <span className="text-blue-400 ml-1 text-xs">*{item.notes}</span>}
                      </div>
                      <span className="text-gray-400 ml-2 shrink-0">${(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Pie de la orden + Botón de cobrar */}
                <div className="px-3 md:px-4 py-3 border-t border-gray-700 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-xs">👤 {order.user.name}</span>
                    <span className="text-white font-bold text-lg">${order.total?.toFixed(2)}</span>
                  </div>
                  
                  <button
                    onClick={() => openPayModal(order)}
                    disabled={isPaying}
                    className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-600 text-white font-bold py-3 md:py-2.5 rounded-xl md:rounded-lg transition-colors text-sm"
                  >
                    {isPaying ? 'Procesando...' : `💰 Cobrar $${order.total?.toFixed(2)}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Selección de método de pago */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPayModal(null)} />
          <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-700">
            <h2 className="text-white font-bold text-lg mb-1">💰 Cobrar cuenta</h2>
            <p className="text-gray-400 text-sm mb-4">
              {payModal.table ? `Mesa: ${payModal.table.name}` : 'Para llevar'} — Total: <span className="text-emerald-400 font-bold">${payModal.total?.toFixed(2)}</span>
            </p>

            {/* Métodos de pago */}
            <p className="text-gray-400 text-xs mb-2">Selecciona el método de pago:</p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {PAYMENT_METHODS.map((pm) => (
                <button
                  key={pm.method}
                  onClick={() => setSelectedMethod(pm.method)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    selectedMethod === pm.method
                      ? pm.color + ' border-opacity-100 scale-[1.02]'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <span className="text-2xl block mb-1">{pm.icon}</span>
                  <span className="text-xs font-medium">{pm.label}</span>
                </button>
              ))}
            </div>

            {/* Asignar cliente (opcional — para puntos de lealtad) */}
            <div className="mb-4">
              <p className="text-gray-400 text-xs mb-2">Asignar cliente (opcional):</p>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-xl px-3 py-2">
                  <span className="text-blue-400 text-sm font-medium">👤 {selectedCustomer.name}</span>
                  <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 hover:text-white text-xs">✕</button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => searchCustomers(e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="Buscar por nombre o teléfono..."
                  />
                  {customerResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-xl overflow-hidden z-10">
                      {customerResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedCustomer({ id: c.id, name: `${c.firstName} ${c.lastName}` }); setCustomerResults([]); setCustomerSearch(''); }}
                          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 flex justify-between"
                        >
                          <span>{c.firstName} {c.lastName}</span>
                          <span className="text-emerald-400 text-xs">{c.loyaltyPoints} pts</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              <button
                onClick={() => setPayModal(null)}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPay}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors"
              >
                ✓ Confirmar cobro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
