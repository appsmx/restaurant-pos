import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

interface TableInfo {
  id: string;
  name: string;
}

interface Reservation {
  id: string;
  customerName: string;
  phone: string | null;
  date: string;
  time: string;
  guests: number;
  notes: string | null;
  status: string;
  table: TableInfo | null;
  createdAt: string;
}

interface AvailableTable {
  id: string;
  name: string;
  capacity: number;
  status: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  CONFIRMED: { label: 'Confirmada', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: '📅' },
  SEATED: { label: 'Sentado', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: '🍽️' },
  COMPLETED: { label: 'Completada', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: '✅' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: '❌' },
  NO_SHOW: { label: 'No llegó', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: '👻' },
};

export default function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<AvailableTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAll, setShowAll] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    date: new Date().toISOString().split('T')[0],
    time: '19:00',
    guests: 2,
    tableId: '',
    notes: '',
  });

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const params = showAll ? '' : `?date=${selectedDate}`;
      const data = await apiClient(`/reservations${params}`, 'GET');
      setReservations(data);
    } catch (err) {
      console.error('Error fetching reservations');
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async () => {
    try {
      const data = await apiClient('/floorplan/sections', 'GET');
      const allTables: AvailableTable[] = [];
      for (const section of data) {
        for (const table of section.tables) {
          allTables.push(table);
        }
      }
      setTables(allTables);
    } catch {}
  };

  useEffect(() => {
    fetchReservations();
    fetchTables();
  }, [selectedDate, showAll]);

  const resetForm = () => {
    setFormData({
      customerName: '',
      phone: '',
      date: selectedDate,
      time: '19:00',
      guests: 2,
      tableId: '',
      notes: '',
    });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!formData.customerName || !formData.date || !formData.time) return;

    try {
      const payload = {
        customerName: formData.customerName,
        phone: formData.phone || undefined,
        date: formData.date,
        time: formData.time,
        guests: formData.guests,
        tableId: formData.tableId || undefined,
        notes: formData.notes || undefined,
      };

      if (editingId) {
        await apiClient(`/reservations/${editingId}`, 'PATCH', payload);
      } else {
        await apiClient('/reservations', 'POST', payload);
      }

      setShowForm(false);
      resetForm();
      fetchReservations();
    } catch (err: any) {
      alert(err.message || 'Error al guardar reservación');
    }
  };

  const handleEdit = (reservation: Reservation) => {
    setFormData({
      customerName: reservation.customerName,
      phone: reservation.phone || '',
      date: reservation.date.split('T')[0],
      time: reservation.time,
      guests: reservation.guests,
      tableId: reservation.table?.id || '',
      notes: reservation.notes || '',
    });
    setEditingId(reservation.id);
    setShowForm(true);
  };

  const handleCancel = async (id: string) => {
    if (!confirm('¿Cancelar esta reservación?')) return;
    try {
      await apiClient(`/reservations/${id}/cancel`, 'PATCH');
      fetchReservations();
    } catch (err: any) {
      alert(err.message || 'Error al cancelar');
    }
  };

  const handleSeat = async (id: string) => {
    try {
      await apiClient(`/reservations/${id}/seat`, 'PATCH');
      fetchReservations();
    } catch (err: any) {
      alert(err.message || 'Error al marcar como sentado');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await apiClient(`/reservations/${id}/complete`, 'PATCH');
      fetchReservations();
    } catch (err: any) {
      alert(err.message || 'Error al completar');
    }
  };

  const handleNoShow = async (id: string) => {
    if (!confirm('¿Marcar como "No llegó"?')) return;
    try {
      await apiClient(`/reservations/${id}`, 'PATCH', { status: 'NO_SHOW' });
      fetchReservations();
    } catch (err: any) {
      alert(err.message || 'Error');
    }
  };

  // Date navigation
  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return 'Hoy';
    if (d.toDateString() === tomorrow.toDateString()) return 'Mañana';

    return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === todayStr;

  // Group reservations by time slot for calendar view
  const timeSlots = ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold">📅 Reservaciones</h1>
          <span className="bg-blue-500/20 text-blue-400 text-xs font-medium px-2 py-0.5 rounded-full">
            {reservations.length} {showAll ? 'total' : 'del día'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowAll(!showAll); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showAll ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {showAll ? '📋 Todas' : '📅 Por día'}
          </button>
          <button
            onClick={() => { resetForm(); setFormData((f) => ({ ...f, date: selectedDate })); setShowForm(true); }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            + Nueva
          </button>
        </div>
      </div>

      {/* Date selector (only when filtering by day) */}
      {!showAll && (
        <div className="flex items-center justify-center gap-3 mb-5 bg-gray-800/50 rounded-xl py-2.5 px-4">
          <button onClick={() => changeDate(-1)} className="text-gray-400 hover:text-white text-lg px-2">◀</button>
          <div className="text-center">
            <p className="text-white font-bold text-sm">{formatDate(selectedDate)}</p>
            <p className="text-gray-500 text-xs">{selectedDate}</p>
          </div>
          <button onClick={() => changeDate(1)} className="text-gray-400 hover:text-white text-lg px-2">▶</button>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="text-blue-400 hover:text-blue-300 text-xs ml-2"
            >
              Hoy
            </button>
          )}
        </div>
      )}

      {/* Reservations list */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><p className="text-gray-400">Cargando...</p></div>
      ) : reservations.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
          <p className="text-4xl mb-2">📅</p>
          <p className="text-lg font-medium">Sin reservaciones</p>
          <p className="text-sm mt-1">{showAll ? 'No hay reservaciones registradas' : `No hay reservaciones para ${formatDate(selectedDate)}`}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Timeline view */}
          {reservations.map((res) => {
            const config = STATUS_CONFIG[res.status] || STATUS_CONFIG.CONFIRMED;
            return (
              <div key={res.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="flex items-stretch">
                  {/* Time column */}
                  <div className="w-20 shrink-0 bg-gray-900 flex flex-col items-center justify-center p-3 border-r border-gray-700">
                    <span className="text-white font-bold text-lg">{res.time}</span>
                    {!showAll && <span className="text-gray-500 text-[10px] mt-0.5">{res.guests} pers.</span>}
                    {showAll && (
                      <span className="text-gray-500 text-[10px] mt-0.5">
                        {new Date(res.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-white font-semibold text-sm">{res.customerName}</h3>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {res.phone && <span className="text-gray-500 text-xs">📞 {res.phone}</span>}
                          <span className="text-gray-500 text-xs">👥 {res.guests}</span>
                          {res.table && (
                            <span className="text-blue-400 text-xs font-medium">🍽️ {res.table.name}</span>
                          )}
                        </div>
                        {res.notes && <p className="text-gray-400 text-xs mt-1">📝 {res.notes}</p>}
                      </div>
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium ${config.color}`}>
                        {config.icon} {config.label}
                      </span>
                    </div>

                    {/* Actions */}
                    {(res.status === 'CONFIRMED' || res.status === 'SEATED') && (
                      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                        {res.status === 'CONFIRMED' && (
                          <>
                            <button
                              onClick={() => handleSeat(res.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium rounded-lg transition-colors"
                            >
                              🍽️ Sentar
                            </button>
                            <button
                              onClick={() => handleNoShow(res.id)}
                              className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-[11px] font-medium rounded-lg transition-colors"
                            >
                              👻 No llegó
                            </button>
                          </>
                        )}
                        {res.status === 'SEATED' && (
                          <button
                            onClick={() => handleComplete(res.id)}
                            className="px-2.5 py-1 bg-gray-600 hover:bg-gray-500 text-white text-[11px] font-medium rounded-lg transition-colors"
                          >
                            ✅ Completar
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(res)}
                          className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-[11px] font-medium rounded-lg transition-colors"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => handleCancel(res.id)}
                          className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-[11px] font-medium rounded-lg transition-colors"
                        >
                          ✕ Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== CREATE/EDIT FORM MODAL ==================== */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setShowForm(false); resetForm(); }} />
          <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-md border border-gray-700 max-h-[90vh] overflow-auto">
            <h2 className="text-white font-bold text-lg mb-4">
              {editingId ? '✏️ Editar Reservación' : '📅 Nueva Reservación'}
            </h2>

            <div className="space-y-3">
              {/* Customer name */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Nombre del cliente *</label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Juan Pérez"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Teléfono</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="55 1234 5678"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Fecha *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Hora *</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Guests & Table */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Comensales</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.guests}
                    onChange={(e) => setFormData({ ...formData, guests: parseInt(e.target.value) || 1 })}
                    className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Mesa (opcional)</label>
                  <select
                    value={formData.tableId}
                    onChange={(e) => setFormData({ ...formData, tableId: e.target.value })}
                    className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Sin asignar</option>
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.capacity} pers.)</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none resize-none"
                  rows={2}
                  placeholder="Cumpleaños, alergias, preferencias..."
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.customerName || !formData.date || !formData.time}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded-xl transition-colors"
              >
                {editingId ? '✓ Guardar' : '✓ Reservar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
