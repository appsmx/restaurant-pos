import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { useOrderStore } from '../stores/orderStore';

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

const STATUS_CYCLE = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY', 'OUT_OF_SERVICE'];

import { View } from '../components/POSLayout';

interface FloorPlanProps {
  onViewChange: (view: View) => void;
}

export default function FloorPlan({ onViewChange }: FloorPlanProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const setSelectedTable = useOrderStore((s) => s.setSelectedTable);

  const fetchSections = async () => {
    try {
      setLoading(true);
      const data = await apiClient('/floorplan/sections', 'GET');
      setSections(data);
    } catch (err) {
      setError('Error al cargar las mesas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const handleTableClick = async (table: Table) => {
    if (table.status === 'AVAILABLE') {
      // Si está disponible, la selecciona y manda al menú
      setSelectedTable({ id: table.id, name: table.name });
      onViewChange('menu');
    } else {
      // Si no, ejecuta el ciclo de estados normal
      const currentIndex = STATUS_CYCLE.indexOf(table.status);
      const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
      try {
        await apiClient(`/floorplan/tables/${table.id}/status`, 'PATCH', { status: nextStatus });
        fetchSections();
      } catch (err) {
        setError('Error al cambiar estado');
      }
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-lg">Cargando mesas...</p></div>;
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-red-400 text-lg">{error}</p></div>;

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
                  return (
                    <button
                      key={table.id}
                      onClick={() => handleTableClick(table)}
                      className={`${config.bg} ${config.border} border-2 rounded-xl p-3 md:p-4 flex flex-col items-center gap-0.5 md:gap-1 hover:opacity-80 active:scale-95 transition-all cursor-pointer`}
                      title={table.status === 'AVAILABLE' ? 'Toca para tomar pedido' : 'Toca para cambiar estado'}
                    >
                      <span className="text-white font-bold text-sm md:text-lg">{table.name}</span>
                      <span className="text-white/70 text-[10px] md:text-xs">{table.capacity} pers.</span>
                      <span className="text-white/50 text-[9px] md:text-[10px] uppercase tracking-wide">{config.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}