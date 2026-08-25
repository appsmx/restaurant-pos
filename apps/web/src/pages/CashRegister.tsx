import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

interface CashMovement {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  createdAt: string;
  user?: { name: string };
}

interface RegisterSummary {
  register: {
    id: string;
    openingAmount: number;
    openedAt: string;
    status: string;
  };
  summary: {
    opening: number;
    sales: number;
    deposits: number;
    withdrawals: number;
    expenses: number;
    currentTotal: number;
  };
}

type ModalType = 'none' | 'open' | 'close' | 'movement';
type MovementType = 'DEPOSIT' | 'WITHDRAWAL' | 'EXPENSE';

const MOVEMENT_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  OPENING: { label: 'Apertura', icon: '🔓', color: 'text-blue-400' },
  SALE: { label: 'Venta', icon: '💰', color: 'text-emerald-400' },
  DEPOSIT: { label: 'Depósito', icon: '📥', color: 'text-emerald-400' },
  WITHDRAWAL: { label: 'Retiro', icon: '📤', color: 'text-red-400' },
  EXPENSE: { label: 'Gasto', icon: '🧾', color: 'text-orange-400' },
  CLOSING: { label: 'Cierre', icon: '🔒', color: 'text-purple-400' },
};

export default function CashRegister() {
  const [data, setData] = useState<RegisterSummary | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'current' | 'history'>('current');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalType>('none');
  const [submitting, setSubmitting] = useState(false);
  const [salesDetail, setSalesDetail] = useState<{ totalSales: number; totalTips: number; orderCount: number; byMethod: Record<string, { count: number; total: number; tips: number }> } | null>(null);

  // Form states
  const [openAmount, setOpenAmount] = useState('');
  const [closeAmount, setCloseAmount] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [movType, setMovType] = useState<MovementType>('DEPOSIT');
  const [movAmount, setMovAmount] = useState('');
  const [movDesc, setMovDesc] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const detail = await apiClient('/cash/shift-detail', 'GET');
      if (detail) {
        setData({ register: detail.register, summary: detail.summary });
        setMovements(detail.movements || []);
        setSalesDetail(detail.salesDetail || null);
      } else {
        setData(null);
        setMovements([]);
        setSalesDetail(null);
      }
    } catch (err) {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const hist = await apiClient('/cash/history?limit=20', 'GET');
      setHistory(hist || []);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    fetchData();
    fetchHistory();
  }, []);

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient('/cash/open', 'POST', { openingAmount: parseFloat(openAmount) || 0 });
      setModal('none');
      setOpenAmount('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al abrir caja');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await apiClient('/cash/close', 'POST', {
        closingAmount: parseFloat(closeAmount) || 0,
        notes: closeNotes || undefined,
      });
      setModal('none');
      setCloseAmount('');
      setCloseNotes('');
      const diff = result.difference;
      if (diff === 0) {
        alert('✅ Caja cuadrada perfectamente');
      } else if (diff > 0) {
        alert(`⚠️ Sobrante de $${diff.toFixed(2)} — hay más dinero del esperado`);
      } else {
        alert(`⚠️ Faltante de $${Math.abs(diff).toFixed(2)} — hay menos dinero del esperado`);
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al cerrar caja');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient('/cash/movement', 'POST', {
        type: movType,
        amount: parseFloat(movAmount),
        description: movDesc,
      });
      setModal('none');
      setMovAmount('');
      setMovDesc('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al registrar movimiento');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-lg">Cargando caja...</p></div>;

  // No register open — show "Open register" screen
  if (!data) {
    return (
      <div>
        <h1 className="text-xl md:text-2xl font-bold mb-6">💰 Caja</h1>
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <p className="text-5xl mb-4">🔒</p>
          <h2 className="text-white font-bold text-lg mb-2">La caja está cerrada</h2>
          <p className="text-gray-400 text-sm mb-6">Abre la caja para iniciar el turno y registrar movimientos de efectivo.</p>
          <button
            onClick={() => setModal('open')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl transition-colors"
          >
            🔓 Abrir Caja
          </button>
        </div>

        {/* Modal: Abrir caja */}
        {modal === 'open' && (
          <Modal onClose={() => setModal('none')}>
            <h2 className="text-white font-bold text-lg mb-4">🔓 Abrir Caja</h2>
            <form onSubmit={handleOpenRegister} className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Monto inicial en caja (efectivo contado)</label>
                <input
                  type="number"
                  value={openAmount}
                  onChange={(e) => setOpenAmount(e.target.value)}
                  className="w-full bg-gray-800 text-white text-lg rounded-xl border border-gray-600 px-4 py-3 focus:border-blue-500 focus:outline-none text-center font-bold"
                  placeholder="$0.00"
                  min="0"
                  step="0.01"
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setModal('none')} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl">Cancelar</button>
                <button type="submit" disabled={submitting} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm font-bold rounded-xl">
                  {submitting ? 'Abriendo...' : '✓ Abrir Caja'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    );
  }

  // Register is open — show summary + movements
  const { summary } = data;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">💰 Caja</h1>
          <p className="text-emerald-400 text-xs mt-0.5">🟢 Abierta desde {formatTime(data.register.openedAt)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal('movement')}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs md:text-sm rounded-xl transition-colors"
          >
            ± Movimiento
          </button>
          <button
            onClick={() => setModal('close')}
            className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs md:text-sm rounded-xl transition-colors"
          >
            🔒 Cerrar Caja
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <SummaryCard label="En caja" value={summary.currentTotal} icon="💵" color="emerald" large />
        <SummaryCard label="Apertura" value={summary.opening} icon="🔓" color="blue" />
        <SummaryCard label="Ventas" value={summary.sales} icon="🧾" color="emerald" />
        <SummaryCard label="Depósitos" value={summary.deposits} icon="📥" color="blue" />
        <SummaryCard label="Retiros" value={summary.withdrawals} icon="📤" color="red" />
        <SummaryCard label="Gastos" value={summary.expenses} icon="💸" color="orange" />
      </div>

      {/* Movements list */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">Movimientos del turno</h2>
          <span className="text-gray-500 text-xs">{movements.filter((m) => m.type !== 'OPENING').length} movimientos</span>
        </div>
        <div className="divide-y divide-gray-700/50 max-h-60 overflow-auto">
          {movements.map((mov) => (
            <MovementRow key={mov.id} type={mov.type} amount={mov.amount} description={mov.description} time={formatTime(mov.createdAt)} user={mov.user?.name || ''} />
          ))}
          {movements.length === 0 && (
            <div className="p-6 text-center text-gray-500 text-sm">Sin movimientos registrados</div>
          )}
        </div>
      </div>

      {/* Sales by payment method */}
      {salesDetail && salesDetail.orderCount > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mt-4">
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="text-white font-semibold text-sm">💳 Ventas por método de pago</h2>
            <p className="text-gray-500 text-xs mt-0.5">{salesDetail.orderCount} órdenes cobradas · ${salesDetail.totalSales.toFixed(2)} total{salesDetail.totalTips > 0 ? ` + $${salesDetail.totalTips.toFixed(2)} propinas` : ''}</p>
          </div>
          <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(salesDetail.byMethod).map(([method, data]) => (
              <div key={method} className="bg-gray-900 rounded-lg p-3 text-center">
                <p className="text-sm mb-0.5">{method === 'CASH' ? '💵' : method === 'CARD' ? '💳' : method === 'TRANSFER' ? '📲' : '🔄'}</p>
                <p className="text-white font-bold text-sm">${data.total.toFixed(2)}</p>
                <p className="text-gray-500 text-[10px]">{data.count} {data.count === 1 ? 'pago' : 'pagos'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Section */}
      {history.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mt-4">
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="text-white font-semibold text-sm">📜 Turnos anteriores</h2>
          </div>
          <div className="divide-y divide-gray-700/50 max-h-48 overflow-auto">
            {history.slice(0, 5).map((reg: any) => (
              <div key={reg.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-medium">
                    {new Date(reg.openedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} — {new Date(reg.openedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} a {reg.closedAt ? new Date(reg.closedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '?'}
                  </p>
                  <p className="text-gray-500 text-xs">
                    Apertura: ${reg.openingAmount?.toFixed(2)} · Esperado: ${reg.expectedAmount?.toFixed(2)} · Cierre: ${reg.closingAmount?.toFixed(2)}
                  </p>
                </div>
                <span className={`text-sm font-bold ${reg.difference === 0 ? 'text-emerald-400' : reg.difference > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {reg.difference === 0 ? '✓ Cuadra' : reg.difference > 0 ? `+$${reg.difference?.toFixed(2)}` : `-$${Math.abs(reg.difference)?.toFixed(2)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Cerrar caja */}
      {modal === 'close' && (
        <Modal onClose={() => setModal('none')}>
          <h2 className="text-white font-bold text-lg mb-1">🔒 Cerrar Caja</h2>
          <p className="text-gray-400 text-sm mb-4">Cuenta el efectivo real y regístralo. El sistema calculará la diferencia.</p>
          <form onSubmit={handleCloseRegister} className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Efectivo contado en caja</label>
              <input
                type="number"
                value={closeAmount}
                onChange={(e) => setCloseAmount(e.target.value)}
                className="w-full bg-gray-800 text-white text-lg rounded-xl border border-gray-600 px-4 py-3 focus:border-blue-500 focus:outline-none text-center font-bold"
                placeholder="$0.00"
                min="0"
                step="0.01"
                autoFocus
                required
              />
              <p className="text-gray-500 text-xs mt-1 text-center">Esperado según sistema: <span className="text-emerald-400 font-bold">${summary.currentTotal.toFixed(2)}</span></p>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Notas (opcional)</label>
              <input
                type="text"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                placeholder="Ej: Turno de la mañana completo"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setModal('none')} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl">Cancelar</button>
              <button type="submit" disabled={submitting} className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-sm font-bold rounded-xl">
                {submitting ? 'Cerrando...' : '🔒 Cerrar Caja'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Registrar movimiento */}
      {modal === 'movement' && (
        <Modal onClose={() => setModal('none')}>
          <h2 className="text-white font-bold text-lg mb-4">± Registrar Movimiento</h2>
          <form onSubmit={handleAddMovement} className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs mb-1.5 block">Tipo</label>
              <div className="grid grid-cols-3 gap-2">
                {([['DEPOSIT', '📥', 'Depósito'], ['WITHDRAWAL', '📤', 'Retiro'], ['EXPENSE', '💸', 'Gasto']] as const).map(([type, icon, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMovType(type)}
                    className={`p-2.5 rounded-xl text-xs font-medium border-2 transition-all text-center ${
                      movType === type
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <span className="text-lg block mb-0.5">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Monto</label>
              <input
                type="number"
                value={movAmount}
                onChange={(e) => setMovAmount(e.target.value)}
                className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                placeholder="$0.00"
                min="0.01"
                step="0.01"
                required
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Descripción</label>
              <input
                type="text"
                value={movDesc}
                onChange={(e) => setMovDesc(e.target.value)}
                className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                placeholder="Ej: Compra de servilletas, Retiro para banco..."
                required
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setModal('none')} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl">Cancelar</button>
              <button type="submit" disabled={submitting || !movAmount || !movDesc} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white text-sm font-bold rounded-xl">
                {submitting ? 'Guardando...' : '✓ Registrar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ==================== Sub-components ====================

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-700">
        {children}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, color, large }: { label: string; value: number; icon: string; color: string; large?: boolean }) {
  const colorMap: Record<string, string> = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
    blue: 'border-blue-500/30 bg-blue-500/5',
    red: 'border-red-500/30 bg-red-500/5',
    orange: 'border-orange-500/30 bg-orange-500/5',
  };
  return (
    <div className={`rounded-xl border p-3 md:p-4 ${colorMap[color] || colorMap.blue} ${large ? 'col-span-2 lg:col-span-1' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{icon}</span>
        <span className="text-gray-400 text-xs">{label}</span>
      </div>
      <p className={`text-white font-bold ${large ? 'text-xl md:text-2xl' : 'text-sm md:text-base'}`}>
        ${value.toFixed(2)}
      </p>
    </div>
  );
}

function MovementRow({ type, amount, description, time, user }: { type: string; amount: number; description: string | null; time: string; user: string }) {
  const config = MOVEMENT_CONFIG[type] || { label: type, icon: '•', color: 'text-gray-400' };
  const isPositive = ['OPENING', 'SALE', 'DEPOSIT'].includes(type);
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-lg">{config.icon}</span>
        <div>
          <p className="text-white text-sm font-medium">{description || config.label}</p>
          <p className="text-gray-500 text-xs">{time}{user ? ` · ${user}` : ''}</p>
        </div>
      </div>
      <span className={`font-bold text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive ? '+' : '-'}${amount.toFixed(2)}
      </span>
    </div>
  );
}
