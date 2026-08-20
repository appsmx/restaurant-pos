import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

interface Summary {
  period: string;
  from: string;
  to: string;
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  topProduct: { name: string; quantity: number; revenue: number } | null;
  paymentMethods: Record<string, { count: number; total: number }>;
}

interface EmployeeSales {
  id: string;
  name: string;
  role: string;
  orders: number;
  total: number;
  avgTicket: number;
}

interface ProductSales {
  id: string;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
}

type Period = 'today' | 'week' | 'month';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  month: 'Este mes',
};

const METHOD_LABELS: Record<string, string> = {
  CASH: '💵 Efectivo',
  CARD: '💳 Tarjeta',
  TRANSFER: '📲 Transferencia',
  OTHER: '🔄 Otro',
};

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('today');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [employees, setEmployees] = useState<EmployeeSales[]>([]);
  const [products, setProducts] = useState<ProductSales[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [summaryData, employeeData, productData] = await Promise.all([
        apiClient(`/reports/summary?period=${period}`, 'GET'),
        apiClient(`/reports/by-employee?period=${period}`, 'GET'),
        apiClient(`/reports/by-product?period=${period}`, 'GET'),
      ]);
      setSummary(summaryData);
      setEmployees(employeeData);
      setProducts(productData);
    } catch (err) {
      setError('Error al cargar los reportes. Verifica que tengas permisos de administrador.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-lg">Cargando dashboard...</p></div>;
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-red-400 text-lg text-center px-4">{error}</p></div>;
  if (!summary) return null;

  return (
    <div>
      {/* Header + Period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h1 className="text-xl md:text-2xl font-bold">📊 Dashboard</h1>
        <div className="flex gap-2">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-full text-xs md:text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KPICard
          icon="💰"
          label="Ventas totales"
          value={`$${summary.totalSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
          color="emerald"
        />
        <KPICard
          icon="🧾"
          label="Órdenes"
          value={summary.totalOrders.toString()}
          color="blue"
        />
        <KPICard
          icon="🎫"
          label="Ticket promedio"
          value={`$${summary.avgTicket.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
          color="purple"
        />
        <KPICard
          icon="⭐"
          label="Más vendido"
          value={summary.topProduct?.name || 'Sin datos'}
          subtitle={summary.topProduct ? `${summary.topProduct.quantity} vendidos` : undefined}
          color="amber"
        />
      </div>

      {/* Two columns on desktop: Employees + Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">

        {/* Ventas por empleado */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="text-white font-semibold text-sm md:text-base">👤 Ventas por empleado</h2>
          </div>
          <div className="p-3 md:p-4">
            {employees.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Sin ventas en este período</p>
            ) : (
              <div className="space-y-3">
                {employees.map((emp, i) => (
                  <div key={emp.id} className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs font-mono w-5 shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-medium truncate">{emp.name}</span>
                        <span className="text-emerald-400 font-bold text-sm ml-2">${emp.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-gray-500 text-xs">{emp.orders} órdenes</span>
                        <span className="text-gray-600 text-xs">·</span>
                        <span className="text-gray-500 text-xs">Ticket: ${emp.avgTicket}</span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${employees[0] ? (emp.total / employees[0].total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Productos más vendidos */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="text-white font-semibold text-sm md:text-base">🏆 Productos más vendidos</h2>
          </div>
          <div className="p-3 md:p-4">
            {products.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Sin ventas en este período</p>
            ) : (
              <div className="space-y-3">
                {products.slice(0, 8).map((prod, i) => (
                  <div key={prod.id} className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs font-mono w-5 shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-medium truncate">{prod.name}</span>
                        <span className="text-blue-400 font-bold text-sm ml-2">x{prod.quantity}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-gray-500 text-xs">{prod.category}</span>
                        <span className="text-gray-400 text-xs">${prod.revenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${products[0] ? (prod.quantity / products[0].quantity) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Métodos de pago */}
      {Object.keys(summary.paymentMethods).length > 0 && (
        <div className="mt-4 md:mt-6 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700">
            <h2 className="text-white font-semibold text-sm md:text-base">💳 Métodos de pago</h2>
          </div>
          <div className="p-3 md:p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(summary.paymentMethods).map(([method, data]) => (
                <div key={method} className="bg-gray-900 rounded-lg p-3 text-center">
                  <p className="text-lg mb-1">{METHOD_LABELS[method] || method}</p>
                  <p className="text-white font-bold text-sm">${data.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{data.count} {data.count === 1 ? 'pago' : 'pagos'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== KPI Card Component ====================

interface KPICardProps {
  icon: string;
  label: string;
  value: string;
  subtitle?: string;
  color: 'emerald' | 'blue' | 'purple' | 'amber';
}

const COLOR_MAP = {
  emerald: 'border-emerald-500/30 bg-emerald-500/5',
  blue: 'border-blue-500/30 bg-blue-500/5',
  purple: 'border-purple-500/30 bg-purple-500/5',
  amber: 'border-amber-500/30 bg-amber-500/5',
};

function KPICard({ icon, label, value, subtitle, color }: KPICardProps) {
  return (
    <div className={`rounded-xl border p-3 md:p-4 ${COLOR_MAP[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg md:text-xl">{icon}</span>
        <span className="text-gray-400 text-xs md:text-sm">{label}</span>
      </div>
      <p className="text-white font-bold text-base md:text-xl truncate">{value}</p>
      {subtitle && <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>}
    </div>
  );
}
