import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

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

export default function FloorPlan() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const handleStatusChange = async (tableId: string, currentStatus: string) => {
    const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];

    try {
      await apiClient(`/floorplan/tables/${tableId}/status`, 'PATCH', { status: nextStatus });
      fetchSections();
    } catch (err) {
      setError('Error al cambiar estado');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-lg">Cargando mesas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400 text-lg">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mesas</h1>
        <div className="flex gap-4 text-sm">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${config.bg}`}></div>
              <span className="text-gray-400">{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
          <p>No hay secciones configuradas</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.id}>
              <h2 className="text-lg font-semibold text-gray-300 mb-3 border-b border-gray-800 pb-2">
                {section.name}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {section.tables.map((table) => {
                  const config = STATUS_CONFIG[table.status] || STATUS_CONFIG.AVAILABLE;
                  return (
                    <button
                      key={table.id}
                      onClick={() => handleStatusChange(table.id, table.status)}
                      className={`${config.bg} ${config.border} border-2 rounded-lg p-4 flex flex-col items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer`}
                      title={`Clic para cambiar estado`}
                    >
                      <span className="text-white font-bold text-lg">{table.name}</span>
                      <span className="text-white/70 text-xs">{table.capacity} personas</span>
                      <span className="text-white/50 text-[10px] uppercase tracking-wide">{config.label}</span>
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