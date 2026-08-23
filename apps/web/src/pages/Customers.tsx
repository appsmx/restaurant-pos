import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  notes: string | null;
  loyaltyPoints: number;
  totalVisits: number;
  totalSpent: number;
}

interface OrderHistoryItem {
  id: string;
  total: number;
  type: string;
  closedAt: string;
  table: { name: string } | null;
  user: { name: string };
  items: { quantity: number; product: { name: string; price: number } }[];
  payments: { method: string; amount: number; createdAt: string }[];
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

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Profile/History view
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [historyPagination, setHistoryPagination] = useState<Pagination>({ page: 1, limit: 15, total: 0, pages: 0 });
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [notes, setNotes] = useState('');

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const url = search ? `/customers?search=${encodeURIComponent(search)}` : '/customers';
      const data = await apiClient(url, 'GET');
      setCustomers(data);
    } catch (err) {
      console.error('Error fetching customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (customerId: string, page: number = 1) => {
    try {
      setLoadingHistory(true);
      const data = await apiClient(`/customers/${customerId}/history?page=${page}&limit=15`, 'GET');
      setHistory(data.orders);
      setHistoryPagination(data.pagination);
      // Update customer data with latest stats
      if (data.customer) {
        setSelectedCustomer(data.customer);
      }
    } catch (err) {
      console.error('Error fetching history');
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearch = () => {
    fetchCustomers();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient('/customers', 'POST', {
        firstName, lastName,
        phone: phone || undefined,
        email: email || undefined,
        birthday: birthday || undefined,
        notes: notes || undefined,
      });
      setShowCreate(false);
      resetForm();
      fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Error al crear cliente');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFirstName(''); setLastName(''); setPhone(''); setEmail(''); setBirthday(''); setNotes('');
  };

  const openProfile = (customer: Customer) => {
    setSelectedCustomer(customer);
    fetchHistory(customer.id, 1);
  };

  const closeProfile = () => {
    setSelectedCustomer(null);
    setHistory([]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Cargando clientes...</p></div>;

  // ==================== PROFILE VIEW ====================
  if (selectedCustomer) {
    return (
      <div>
        {/* Back button + header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={closeProfile}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-xl transition-colors"
          >
            ← Volver
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">
              👤 {selectedCustomer.firstName} {selectedCustomer.lastName}
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">Perfil y historial de compras</p>
          </div>
        </div>

        {/* Customer stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-3 text-center">
            <p className="text-emerald-400 font-bold text-lg md:text-xl">{selectedCustomer.loyaltyPoints}</p>
            <p className="text-gray-500 text-xs mt-0.5">🎖️ Puntos</p>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-3 text-center">
            <p className="text-blue-400 font-bold text-lg md:text-xl">{selectedCustomer.totalVisits}</p>
            <p className="text-gray-500 text-xs mt-0.5">📍 Visitas</p>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-3 text-center">
            <p className="text-purple-400 font-bold text-lg md:text-xl">
              ${selectedCustomer.totalSpent.toLocaleString('es-MX', { minimumFractionDigits: 0 })}
            </p>
            <p className="text-gray-500 text-xs mt-0.5">💰 Total gastado</p>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-3 text-center">
            <p className="text-amber-400 font-bold text-lg md:text-xl">
              ${selectedCustomer.totalVisits > 0 ? Math.round(selectedCustomer.totalSpent / selectedCustomer.totalVisits) : 0}
            </p>
            <p className="text-gray-500 text-xs mt-0.5">🎫 Ticket promedio</p>
          </div>
        </div>

        {/* Customer contact info */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 mb-5">
          <h2 className="text-white font-semibold text-sm mb-3">📇 Información de contacto</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {selectedCustomer.phone && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs">📱</span>
                <span className="text-white text-sm">{selectedCustomer.phone}</span>
              </div>
            )}
            {selectedCustomer.email && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs">✉️</span>
                <span className="text-white text-sm">{selectedCustomer.email}</span>
              </div>
            )}
            {selectedCustomer.birthday && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs">🎂</span>
                <span className="text-white text-sm">
                  {new Date(selectedCustomer.birthday).toLocaleDateString('es-MX', { day: '2-digit', month: 'long' })}
                </span>
              </div>
            )}
            {selectedCustomer.notes && (
              <div className="flex items-center gap-2 sm:col-span-2">
                <span className="text-gray-500 text-xs">📝</span>
                <span className="text-gray-400 text-sm italic">{selectedCustomer.notes}</span>
              </div>
            )}
            {!selectedCustomer.phone && !selectedCustomer.email && !selectedCustomer.birthday && !selectedCustomer.notes && (
              <p className="text-gray-500 text-xs col-span-2">Sin información de contacto registrada</p>
            )}
          </div>
        </div>

        {/* Purchase history */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-white font-semibold text-sm md:text-base">🧾 Historial de compras</h2>
            <span className="text-gray-500 text-xs">
              {historyPagination.total} {historyPagination.total === 1 ? 'compra' : 'compras'}
            </span>
          </div>

          {loadingHistory ? (
            <div className="p-8 text-center"><p className="text-gray-400 text-sm">Cargando historial...</p></div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-3xl mb-2">🛒</p>
              <p className="text-gray-400 text-sm">Este cliente no tiene compras registradas</p>
              <p className="text-gray-600 text-xs mt-1">Las compras aparecerán cuando se asigne este cliente al cobrar una orden</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-700/50">
                {history.map((order) => (
                  <div key={order.id} className="px-4 py-3">
                    {/* Order header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium">
                          {order.table ? `🍽️ ${order.table.name}` : '📦 Para llevar'}
                        </span>
                        <span className="text-gray-600">·</span>
                        <span className="text-gray-500 text-xs">
                          {formatDate(order.closedAt)} {formatTime(order.closedAt)}
                        </span>
                      </div>
                      <span className="text-emerald-400 font-bold text-sm">
                        ${order.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Items */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {order.items.map((item, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-gray-700 rounded-full text-xs text-gray-300">
                          {item.quantity}x {item.product.name}
                        </span>
                      ))}
                    </div>

                    {/* Payment info */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {order.payments.length > 0 && (
                        <span>
                          {METHOD_ICONS[order.payments[0].method]} {METHOD_LABELS[order.payments[0].method] || order.payments[0].method}
                        </span>
                      )}
                      <span>👤 Atendido por: {order.user.name}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {historyPagination.pages > 1 && (
                <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-center gap-2">
                  <button
                    onClick={() => fetchHistory(selectedCustomer.id, historyPagination.page - 1)}
                    disabled={historyPagination.page <= 1}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors"
                  >
                    ← Anterior
                  </button>
                  <span className="text-gray-400 text-xs px-2">
                    Página {historyPagination.page} de {historyPagination.pages}
                  </span>
                  <button
                    onClick={() => fetchHistory(selectedCustomer.id, historyPagination.page + 1)}
                    disabled={historyPagination.page >= historyPagination.pages}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs rounded-lg transition-colors"
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ==================== MAIN LIST VIEW ====================
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">👥 Clientes</h1>
          <p className="text-gray-500 text-xs mt-0.5">{customers.length} registrados</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors"
        >
          ➕ Nuevo cliente
        </button>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 bg-gray-800 text-white text-sm rounded-xl border border-gray-700 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
          placeholder="Buscar por nombre o teléfono..."
        />
        <button onClick={handleSearch} className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-xl">
          🔍
        </button>
      </div>

      {/* Customer list */}
      {customers.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
          <p className="text-3xl mb-2">👥</p>
          <p>{search ? 'No se encontraron clientes' : 'No hay clientes registrados'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {customers.map((c) => (
            <button
              key={c.id}
              onClick={() => openProfile(c)}
              className="w-full bg-gray-800 rounded-xl border border-gray-700 p-4 text-left hover:bg-gray-750 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-full flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">
                    {c.firstName[0]}{c.lastName[0]}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{c.firstName} {c.lastName}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {c.phone && <span className="text-gray-500 text-xs">📱 {c.phone}</span>}
                      {c.email && <span className="text-gray-500 text-xs">✉️ {c.email}</span>}
                      {c.birthday && <span className="text-gray-500 text-xs">🎂 {new Date(c.birthday).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</span>}
                    </div>
                    {c.notes && <p className="text-gray-500 text-xs mt-1 italic">📝 {c.notes}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-emerald-400 font-bold text-sm">{c.loyaltyPoints} pts</p>
                  <p className="text-gray-500 text-xs">{c.totalVisits} visitas</p>
                  <p className="text-gray-500 text-xs">${c.totalSpent.toFixed(0)} total</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal: Crear cliente */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-700 max-h-[90vh] overflow-auto">
            <h2 className="text-white font-bold text-lg mb-4">➕ Nuevo cliente</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Nombre</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                    placeholder="Juan" required />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Apellido</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                    placeholder="Pérez" required />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Teléfono</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="664 123 4567" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="juan@email.com" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Cumpleaños</label>
                <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Notas</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Alérgico a mariscos, prefiere mesa 3..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl">Cancelar</button>
                <button type="submit" disabled={submitting || !firstName || !lastName} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm font-bold rounded-xl">
                  {submitting ? 'Creando...' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
