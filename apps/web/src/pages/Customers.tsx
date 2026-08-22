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

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Cargando clientes...</p></div>;

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
            <div key={c.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
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
            </div>
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
