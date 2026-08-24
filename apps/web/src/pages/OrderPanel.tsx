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

  // Discount state
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountReason, setDiscountReason] = useState('');

  // Tip state
  const [tipAmount, setTipAmount] = useState('');

  // Split payment state
  const [splitOrder, setSplitOrder] = useState<Order | null>(null);
  const [splitParts, setSplitParts] = useState(2);
  const [splitPayments, setSplitPayments] = useState<{ amount: number; method: string; label: string }[]>([]);
  const [splitAmount, setSplitAmount] = useState('');
  const [splitMethod, setSplitMethod] = useState<PaymentMethod>('CASH');
  const [splitLabel, setSplitLabel] = useState('');

  const handleSplitPayment = async () => {
    if (!splitOrder || !splitAmount) return;
    try {
      const result = await apiClient(`/orders/${splitOrder.id}/split-pay`, 'POST', {
        method: splitMethod,
        amount: parseFloat(splitAmount),
        tip: 0,
        label: splitLabel || `Pago ${splitPayments.length + 1}`,
      });
      setSplitPayments([...splitPayments, { amount: parseFloat(splitAmount), method: splitMethod, label: splitLabel || `Pago ${splitPayments.length + 1}` }]);
      setSplitAmount('');
      setSplitLabel('');
      if (result.status === 'CLOSED') {
        alert('✅ Cuenta saldada — orden cerrada');
      }
    } catch (err: any) {
      alert(err.message || 'Error al procesar pago parcial');
    }
  };

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
    // Guard: warn if order hasn't been marked as READY by kitchen
    if (order.status !== 'READY' && order.status !== 'DELIVERED') {
      const statusMessages: Record<string, string> = {
        OPEN: 'Esta orden aún NO se ha enviado a cocina.',
        SENT: 'Esta orden fue enviada a cocina pero NO ha empezado a prepararse.',
        PREPARING: 'Esta orden aún se está preparando en cocina.',
      };
      const msg = statusMessages[order.status] || 'Esta orden no está lista.';
      const forceCharge = confirm(`⚠️ ${msg}\n\n¿Cobrar de todas formas?`);
      if (!forceCharge) return;
    }

    setPayModal(order);
    setSelectedMethod('CASH');
    setSelectedCustomer(null);
    setCustomerSearch('');
    setCustomerResults([]);
    setDiscountEnabled(false);
    setDiscountType('PERCENT');
    setDiscountAmount('');
    setDiscountReason('');
    setTipAmount('');
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
      const payload: any = {
        method: selectedMethod,
        customerId: selectedCustomer?.id || null,
      };

      // Add discount if enabled
      if (discountEnabled && discountAmount && parseFloat(discountAmount) > 0) {
        payload.discount = {
          amount: parseFloat(discountAmount),
          type: discountType,
          reason: discountReason || undefined,
        };
      }

      // Add tip if provided
      if (tipAmount && parseFloat(tipAmount) > 0) {
        payload.tip = parseFloat(tipAmount);
      }

      await apiClient(`/orders/${orderToPay.id}/pay`, 'PATCH', payload);

      // Calculate final amount for ticket
      let finalTotal = orderToPay.total;
      if (payload.discount) {
        const disc = payload.discount.type === 'PERCENT'
          ? orderToPay.total * (payload.discount.amount / 100)
          : payload.discount.amount;
        finalTotal = orderToPay.total - Math.min(disc, orderToPay.total);
      }

      // Ofrecer imprimir ticket
      const shouldPrint = confirm('✅ Cobro exitoso. ¿Imprimir ticket?');
      if (shouldPrint) {
        try {
          const config = await apiClient('/config', 'GET');
          const subtotal = orderToPay.total;
          const taxRate = config.taxRate || 0.16;
          const tax = finalTotal * taxRate;
          const total = finalTotal + tax;

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
                    className={`w-full font-bold py-3 md:py-2.5 rounded-xl md:rounded-lg transition-colors text-sm ${
                      order.status === 'READY' || order.status === 'DELIVERED'
                        ? 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white'
                        : 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white'
                    } disabled:bg-gray-600`}
                  >
                    {isPaying ? 'Procesando...' : order.status === 'READY' || order.status === 'DELIVERED'
                      ? `💰 Cobrar $${order.total?.toFixed(2)}`
                      : `⚠️ Cobrar $${order.total?.toFixed(2)}`
                    }
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

            {/* Descuento (opcional) */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-400 text-xs">Aplicar descuento:</p>
                <button
                  onClick={() => setDiscountEnabled(!discountEnabled)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                    discountEnabled ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {discountEnabled ? '🏷️ Activo' : '➕ Agregar'}
                </button>
              </div>
              {discountEnabled && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="flex bg-gray-800 rounded-lg p-0.5 shrink-0">
                      <button
                        onClick={() => setDiscountType('PERCENT')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium ${discountType === 'PERCENT' ? 'bg-amber-600 text-white' : 'text-gray-400'}`}
                      >
                        %
                      </button>
                      <button
                        onClick={() => setDiscountType('FIXED')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium ${discountType === 'FIXED' ? 'bg-amber-600 text-white' : 'text-gray-400'}`}
                      >
                        $
                      </button>
                    </div>
                    <input
                      type="number"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      className="flex-1 bg-gray-800 text-white text-sm rounded-lg border border-gray-600 px-3 py-1.5 focus:border-amber-500 focus:outline-none"
                      placeholder={discountType === 'PERCENT' ? '10' : '50'}
                      min="0"
                      max={discountType === 'PERCENT' ? '100' : undefined}
                      step="1"
                    />
                  </div>
                  <input
                    type="text"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm rounded-lg border border-gray-600 px-3 py-1.5 focus:border-amber-500 focus:outline-none"
                    placeholder="Razón: Cliente VIP, Promoción, Cortesía..."
                  />
                  {discountAmount && parseFloat(discountAmount) > 0 && (
                    <p className="text-amber-400 text-xs">
                      💰 Descuento: {discountType === 'PERCENT' ? `${discountAmount}%` : `$${discountAmount}`}
                      {' → '}Cobro final: $
                      {discountType === 'PERCENT'
                        ? ((payModal?.total || 0) * (1 - parseFloat(discountAmount) / 100)).toFixed(2)
                        : Math.max(0, (payModal?.total || 0) - parseFloat(discountAmount)).toFixed(2)
                      }
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Propina (opcional) */}
            <div className="mb-4">
              <p className="text-gray-400 text-xs mb-2">💝 Propina (opcional):</p>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setTipAmount(pct === 0 ? '' : String(Math.round((payModal?.total || 0) * pct / 100)))}
                      className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                        tipAmount === String(Math.round((payModal?.total || 0) * pct / 100)) && pct > 0
                          ? 'bg-pink-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {pct === 0 ? 'Sin' : `${pct}%`}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="flex-1 bg-gray-800 text-white text-sm rounded-lg border border-gray-600 px-3 py-1.5 focus:border-pink-500 focus:outline-none"
                  placeholder="$ Monto"
                  min="0"
                  step="5"
                />
              </div>
              {tipAmount && parseFloat(tipAmount) > 0 && (
                <p className="text-pink-400 text-xs mt-1">💝 Propina: ${parseFloat(tipAmount).toFixed(2)}</p>
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
                ✓ Cobrar todo
              </button>
            </div>
            {/* Dividir cuenta option */}
            <button
              onClick={() => { setSplitOrder(payModal); setPayModal(null); setSplitParts(2); setSplitPayments([]); }}
              className="w-full mt-2 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-medium rounded-xl transition-colors"
            >
              ✂️ Dividir cuenta entre varias personas
            </button>
          </div>
        </div>
      )}

      {/* Modal: División de cuenta */}
      {splitOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSplitOrder(null)} />
          <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-md border border-gray-700 max-h-[90vh] overflow-auto">
            <h2 className="text-white font-bold text-lg mb-1">✂️ Dividir cuenta</h2>
            <p className="text-gray-400 text-sm mb-4">
              Total: <span className="text-emerald-400 font-bold">${splitOrder.total?.toFixed(2)}</span>
              {splitPayments.length > 0 && (
                <span className="text-gray-500 ml-2">
                  · Pagado: ${splitPayments.reduce((s, p) => s + p.amount, 0).toFixed(2)}
                  · Restante: <span className="text-amber-400">${(splitOrder.total - splitPayments.reduce((s, p) => s + p.amount, 0)).toFixed(2)}</span>
                </span>
              )}
            </p>

            {/* Quick split buttons */}
            <div className="flex gap-2 mb-4">
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setSplitParts(n)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    splitParts === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  ÷{n}
                </button>
              ))}
            </div>

            <p className="text-gray-500 text-xs mb-2">
              Cada parte: <span className="text-white font-bold">${(splitOrder.total / splitParts).toFixed(2)}</span>
            </p>

            {/* Payment list */}
            {splitPayments.length > 0 && (
              <div className="mb-3 space-y-1">
                {splitPayments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-emerald-400 text-xs">✓ {p.label || `Pago ${i + 1}`}</span>
                    <span className="text-emerald-400 text-xs font-bold">${p.amount.toFixed(2)} ({p.method})</span>
                  </div>
                ))}
              </div>
            )}

            {/* Add payment form */}
            {(splitOrder.total - splitPayments.reduce((s, p) => s + p.amount, 0)) > 0.01 && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-3 space-y-2">
                <p className="text-white text-xs font-medium">Agregar pago #{splitPayments.length + 1}</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={splitAmount}
                    onChange={(e) => setSplitAmount(e.target.value)}
                    className="bg-gray-900 text-white text-sm rounded-lg border border-gray-600 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder={`$${(splitOrder.total / splitParts).toFixed(2)}`}
                    min="0"
                    step="0.5"
                  />
                  <select
                    value={splitMethod}
                    onChange={(e) => setSplitMethod(e.target.value as PaymentMethod)}
                    className="bg-gray-900 text-white text-sm rounded-lg border border-gray-600 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="CASH">💵 Efectivo</option>
                    <option value="CARD">💳 Tarjeta</option>
                    <option value="TRANSFER">📲 Transferencia</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={splitLabel}
                  onChange={(e) => setSplitLabel(e.target.value)}
                  className="w-full bg-gray-900 text-white text-sm rounded-lg border border-gray-600 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder="Nombre (opcional): Juan, María..."
                />
                <button
                  onClick={handleSplitPayment}
                  disabled={!splitAmount || parseFloat(splitAmount) <= 0}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  💰 Registrar pago ${splitAmount ? `$${parseFloat(splitAmount).toFixed(2)}` : ''}
                </button>
              </div>
            )}

            {/* Close button */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setSplitOrder(null); fetchOrders(); }}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors"
              >
                {splitPayments.length > 0 && (splitOrder.total - splitPayments.reduce((s, p) => s + p.amount, 0)) <= 0.01
                  ? '✅ Cerrar (cuenta saldada)' : 'Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
