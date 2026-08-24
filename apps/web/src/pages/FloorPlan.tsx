import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { useOrderStore } from '../stores/orderStore';
import { View } from '../components/POSLayout';

interface Table {
  id: string;
  name: string;
  capacity: number;
  status: string;
}

interface Section {
  id: string;
  name: string;
  sort: number;
  tables: Table[];
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string }> = {
  AVAILABLE: { label: 'Disponible', bg: 'bg-emerald-600', border: 'border-emerald-400', text: 'text-emerald-400' },
  OCCUPIED: { label: 'Ocupada', bg: 'bg-red-600', border: 'border-red-400', text: 'text-red-400' },
  RESERVED: { label: 'Reservada', bg: 'bg-amber-600', border: 'border-amber-400', text: 'text-amber-400' },
  DIRTY: { label: 'Sucia', bg: 'bg-orange-700', border: 'border-orange-400', text: 'text-orange-400' },
  OUT_OF_SERVICE: { label: 'Fuera de servicio', bg: 'bg-gray-700', border: 'border-gray-500', text: 'text-gray-500' },
};

interface FloorPlanProps {
  onViewChange: (view: View) => void;
}

export default function FloorPlan({ onViewChange }: FloorPlanProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ tableName: string; total: number } | null>(null);
  const [reservedTables, setReservedTables] = useState<Record<string, { time: string; customerName: string; guests: number }>>({});
  const setSelectedTable = useOrderStore((s) => s.setSelectedTable);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSections = async () => {
    try {
      setLoading(true);
      const data = await apiClient('/floorplan/sections', 'GET');
      setSections(data);
    } catch (err) {
      showToast('Error al cargar las mesas');
    } finally {
      setLoading(false);
    }
  };

  const fetchReservedTables = async () => {
    try {
      const data = await apiClient('/reservations/reserved-tables', 'GET');
      const map: Record<string, { time: string; customerName: string; guests: number }> = {};
      for (const r of data) {
        map[r.tableId] = { time: r.time, customerName: r.customerName, guests: r.guests };
      }
      setReservedTables(map);
    } catch {
      // Silently fail — reservations are optional info
    }
  };

  useEffect(() => {
    fetchSections();
    fetchReservedTables();
  }, []);

  const handleTableClick = async (table: Table) => {
    if (table.status === 'AVAILABLE') {
      // Disponible → ir al menú para tomar pedido
      setSelectedTable({ id: table.id, name: table.name });
      onViewChange('menu');

    } else if (table.status === 'OCCUPIED') {
      // Ocupada → verificar si tiene orden activa
      try {
        const data = await apiClient(`/floorplan/tables/${table.id}/active-order`, 'GET');
        if (data.hasActiveOrder && data.order) {
          // Tiene cuenta abierta → mostrar alerta
          setAlertInfo({ tableName: table.name, total: data.order.total || 0 });
        } else {
          // No tiene orden activa → ya se cobró, marcar como sucia
          await apiClient(`/floorplan/tables/${table.id}/status`, 'PATCH', { status: 'DIRTY' });
          showToast(`${table.name} marcada como sucia ✓`);
          fetchSections();
        }
      } catch (err) {
        // Si el endpoint falla, asumir que tiene orden activa (seguro)
        setAlertInfo({ tableName: table.name, total: 0 });
      }

    } else if (table.status === 'DIRTY') {
      // Sucia → marcar como disponible
      try {
        await apiClient(`/floorplan/tables/${table.id}/status`, 'PATCH', { status: 'AVAILABLE' });
        showToast(`${table.name} disponible ✓`);
        fetchSections();
      } catch (err) {
        showToast('Error al cambiar estado');
      }

    } else if (table.status === 'RESERVED') {
      // Reservada → marcar como disponible
      try {
        await apiClient(`/floorplan/tables/${table.id}/status`, 'PATCH', { status: 'AVAILABLE' });
        showToast(`${table.name} disponible ✓`);
        fetchSections();
      } catch (err) {
        showToast('Error al cambiar estado');
      }

    } else if (table.status === 'OUT_OF_SERVICE') {
      // Fuera de servicio → marcar como disponible
      try {
        await apiClient(`/floorplan/tables/${table.id}/status`, 'PATCH', { status: 'AVAILABLE' });
        showToast(`${table.name} disponible ✓`);
        fetchSections();
      } catch (err) {
        showToast('Error al cambiar estado');
      }
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-lg">Cargando mesas...</p></div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-2">
        <h1 className="text-xl md:text-2xl font-bold">Mesas</h1>
        <p className="text-gray-500 text-xs md:text-sm">Toca una mesa <span className="text-emerald-400">Disponible</span> para tomar pedido</p>
      </div>

      {sections.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400"><p>No hay secciones configuradas</p></div>
      ) : (
        <div className="space-y-6 md:space-y-8">
          {sections.map((section) => (
            <div key={section.id}>
              <h2 className="text-base md:text-lg font-semibold text-gray-300 mb-2 md:mb-3 border-b border-gray-800 pb-2">{section.name}</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
                {section.tables.map((table) => {
                  const config = STATUS_CONFIG[table.status] || STATUS_CONFIG.AVAILABLE;
                  const reservation = reservedTables[table.id];
                  const hasReservation = !!reservation && table.status !== 'OCCUPIED';
                  return (
                    <button
                      key={table.id}
                      onClick={() => handleTableClick(table)}
                      className={`${config.bg} ${config.border} border-2 rounded-xl p-3 md:p-4 flex flex-col items-center gap-0.5 md:gap-1 hover:opacity-80 active:scale-95 transition-all cursor-pointer relative`}
                    >
                      {hasReservation && (
                        <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                          📅
                        </span>
                      )}
                      <span className="text-white font-bold text-sm md:text-lg">{table.name}</span>
                      {hasReservation ? (
                        <>
                          <span className="text-amber-200 text-[10px] md:text-xs font-medium truncate max-w-full">
                            {reservation.time} · {reservation.guests}p
                          </span>
                          <span className="text-amber-100/70 text-[9px] md:text-[10px] truncate max-w-full">
                            {reservation.customerName}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-white/70 text-[10px] md:text-xs">{table.capacity} pers.</span>
                          <span className="text-white/50 text-[9px] md:text-[10px] uppercase tracking-wide">{config.label}</span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast notification (auto-dismiss en 3s) */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-gray-600 text-white text-sm px-4 py-2.5 rounded-xl shadow-xl animate-pulse">
          {toast}
        </div>
      )}

      {/* Modal: mesa con orden activa */}
      {alertInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAlertInfo(null)} />
          <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-700 text-center">
            <p className="text-3xl mb-3">⚠️</p>
            <h3 className="text-white font-bold text-lg mb-2">{alertInfo.tableName} tiene cuenta abierta</h3>
            <p className="text-gray-400 text-sm mb-4">
              {alertInfo.total > 0 ? (
                <>Esta mesa tiene una orden activa por <span className="text-emerald-400 font-bold">${alertInfo.total.toFixed(2)}</span>. Debes cobrar antes de cambiar su estado.</>
              ) : (
                <>Esta mesa tiene una orden activa. Debes cobrar antes de cambiar su estado.</>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setAlertInfo(null)}
                className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => { setAlertInfo(null); onViewChange('orders'); }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                💰 Ir a cobrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
