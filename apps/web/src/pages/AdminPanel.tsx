import { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';

/**
 * Admin Panel — Logan tenant management interface.
 *
 * Tabs:
 *   1. Dashboard — global stats (tenants, revenue, orders)
 *   2. Tenants — list all tenants with status
 *   3. Crear Negocio — onboarding form to create a new tenant
 */

type Tab = 'dashboard' | 'tenants' | 'create';

interface Stats {
  tenants: { total: number; active: number; inactive: number };
  data: { orders: number; users: number; products: number };
  revenue: { monthlyRecurring: number; pendingSetups: number; totalSetupCollected: number; currency: string };
}

interface TenantItem {
  id: string;
  slug: string;
  name: string;
  businessType: string;
  plan: string;
  active: boolean;
  enabledModules: string[];
  setupPaid: boolean;
  monthlyRate: number;
  createdAt: string;
  _count: { users: number; orders: number; products: number };
}

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🏢 Logan Admin</h1>
        <span className="text-xs text-gray-500">Panel de administración multi-tenant</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800 p-1 rounded-lg w-fit">
        {[
          { id: 'dashboard' as Tab, label: '📊 Dashboard' },
          { id: 'tenants' as Tab, label: '🏪 Negocios' },
          { id: 'create' as Tab, label: '➕ Crear Negocio' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'tenants' && <TenantsTab />}
      {tab === 'create' && <CreateTenantTab onCreated={() => setTab('tenants')} />}
    </div>
  );
}

// ==================== DASHBOARD TAB ====================

function DashboardTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient('/admin/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!stats) return <ErrorMsg msg="No se pudieron cargar las estadísticas" />;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Negocios activos" value={stats.tenants.active} icon="🏪" />
        <StatCard label="Ingresos mensuales" value={`$${stats.revenue.monthlyRecurring.toLocaleString()}`} icon="💰" sublabel="MXN/mes" />
        <StatCard label="Órdenes totales" value={stats.data.orders.toLocaleString()} icon="🧾" />
        <StatCard label="Usuarios totales" value={stats.data.users} icon="👥" />
      </div>

      {/* Summary */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Resumen</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Tenants totales:</span>
            <span className="ml-2 text-white">{stats.tenants.total}</span>
          </div>
          <div>
            <span className="text-gray-500">Inactivos:</span>
            <span className="ml-2 text-red-400">{stats.tenants.inactive}</span>
          </div>
          <div>
            <span className="text-gray-500">Setups pendientes:</span>
            <span className="ml-2 text-yellow-400">{stats.revenue.pendingSetups}</span>
          </div>
          <div>
            <span className="text-gray-500">Setup cobrado:</span>
            <span className="ml-2 text-green-400">${stats.revenue.totalSetupCollected.toLocaleString()} MXN</span>
          </div>
          <div>
            <span className="text-gray-500">Productos totales:</span>
            <span className="ml-2 text-white">{stats.data.products}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== TENANTS TAB ====================

function TenantsTab() {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchTenants = () => {
    apiClient('/admin/tenants')
      .then((data) => setTenants(data.tenants || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      await apiClient(`/admin/tenants/${id}`, 'PATCH', { active: !currentActive });
      setTenants((prev) =>
        prev.map((t) => (t.id === id ? { ...t, active: !currentActive } : t))
      );
    } catch (e) {
      alert('Error al cambiar estado');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {tenants.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No hay negocios registrados todavía.</p>
      ) : (
        <div className="space-y-3">
          {tenants.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className="bg-gray-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-gray-700/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${t.active ? 'bg-blue-600' : 'bg-gray-700'}`}>
                  {t.name[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${t.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {t.active ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                      {t.plan}
                    </span>
                    {!t.setupPaid && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                        Setup pendiente
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {t.slug}.logancorp.mx · {t.businessType.toLowerCase()} · ${t.monthlyRate}/mes
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>👥 {t._count.users}</span>
                <span>🧾 {t._count.orders}</span>
                <span>📋 {t._count.products}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleActive(t.id, t.active); }}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    t.active
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                      : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  }`}
                >
                  {t.active ? 'Desactivar' : 'Reactivar'}
                </button>
                <span className="text-gray-600">→</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedId && (
        <TenantDetailModal
          tenantId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={fetchTenants}
        />
      )}
    </div>
  );
}

// ==================== TENANT DETAIL MODAL ====================

interface ModuleDef {
  id: string;
  label: string;
  description: string;
  core: boolean;
  icon: string;
  minimumPlan: string | null;
}

interface TenantMetrics {
  today: { sales: number; orders: number };
  month: { sales: number; orders: number };
  totalClosedOrders: number;
  activeUsers: number;
  lastActivity: string | null;
}

function TenantDetailModal({ tenantId, onClose, onUpdated }: { tenantId: string; onClose: () => void; onUpdated: () => void }) {
  const [tenant, setTenant] = useState<any>(null);
  const [modules, setModules] = useState<ModuleDef[]>([]);
  const [metrics, setMetrics] = useState<TenantMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [tenantData, modulesData, metricsData] = await Promise.all([
        apiClient(`/admin/tenants/${tenantId}`),
        apiClient('/admin/modules'),
        apiClient(`/admin/tenants/${tenantId}/metrics`).catch(() => null),
      ]);
      setTenant(tenantData);
      setModules(modulesData.modules || []);
      setMetrics(metricsData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tenantId]);

  const toggleModule = async (moduleId: string, currentlyEnabled: boolean) => {
    setSaving(true);
    try {
      const data = await apiClient(`/admin/tenants/${tenantId}/toggle-module`, 'POST', {
        moduleId,
        enabled: !currentlyEnabled,
      });
      setTenant((prev: any) => ({ ...prev, enabledModules: data.enabledModules }));
      onUpdated();
    } catch {
      alert('Error al cambiar módulo');
    } finally {
      setSaving(false);
    }
  };

  const updateBilling = async (patch: Record<string, any>) => {
    setSaving(true);
    try {
      const data = await apiClient(`/admin/tenants/${tenantId}`, 'PATCH', patch);
      setTenant((prev: any) => ({ ...prev, ...data.tenant }));
      onUpdated();
    } catch {
      alert('Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-gray-900 rounded-2xl w-full max-w-2xl border border-gray-700 max-h-[90vh] flex flex-col">
        {loading || !tenant ? (
          <div className="p-12"><LoadingSpinner /></div>
        ) : (
          <>
            {/* Header */}
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold ${tenant.active ? 'bg-blue-600' : 'bg-gray-700'}`}>
                  {tenant.name[0]?.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">{tenant.name}</h2>
                  <p className="text-gray-500 text-xs">{tenant.slug}.logancorp.mx · {tenant.businessType?.toLowerCase()}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-white text-xl p-1">✕</button>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-6">
              {/* Metrics */}
              {metrics && (
                <div>
                  <h3 className="text-white font-semibold text-sm mb-3">📊 Métricas reales</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-emerald-400 font-bold text-lg">${metrics.today.sales.toLocaleString()}</p>
                      <p className="text-gray-500 text-[10px]">Hoy ({metrics.today.orders} órd.)</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-blue-400 font-bold text-lg">${metrics.month.sales.toLocaleString()}</p>
                      <p className="text-gray-500 text-[10px]">Este mes ({metrics.month.orders} órd.)</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-white font-bold text-lg">{metrics.totalClosedOrders}</p>
                      <p className="text-gray-500 text-[10px]">Órdenes totales</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className="text-white font-bold text-lg">{metrics.activeUsers}</p>
                      <p className="text-gray-500 text-[10px]">Usuarios activos</p>
                    </div>
                  </div>
                  {metrics.lastActivity && (
                    <p className="text-gray-600 text-xs mt-2">
                      Última venta: {new Date(metrics.lastActivity).toLocaleString('es-MX')}
                    </p>
                  )}
                </div>
              )}

              {/* Billing */}
              <div>
                <h3 className="text-white font-semibold text-sm mb-3">💰 Facturación</h3>
                <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Plan</span>
                    <select
                      value={tenant.plan}
                      onChange={(e) => updateBilling({ plan: e.target.value })}
                      disabled={saving}
                      className="bg-gray-700 text-white text-sm rounded-lg border border-gray-600 px-3 py-1.5"
                    >
                      <option value="STARTER">Starter — $500/mes</option>
                      <option value="GROWTH">Growth — $1,000/mes</option>
                      <option value="PRO">Pro — $1,500/mes</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Tarifa mensual (MXN)</span>
                    <input
                      type="number"
                      defaultValue={tenant.monthlyRate}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v !== tenant.monthlyRate) updateBilling({ monthlyRate: v });
                      }}
                      className="bg-gray-700 text-white text-sm rounded-lg border border-gray-600 px-3 py-1.5 w-28 text-right"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Setup pagado</span>
                    <button
                      onClick={() => updateBilling({ setupPaid: !tenant.setupPaid })}
                      disabled={saving}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        tenant.setupPaid
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                      }`}
                    >
                      {tenant.setupPaid ? '✓ Pagado' : 'Marcar como pagado'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modules */}
              <div>
                <h3 className="text-white font-semibold text-sm mb-3">🧩 Módulos</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {modules.map((m) => {
                    const enabled = tenant.enabledModules?.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => !m.core && toggleModule(m.id, enabled)}
                        disabled={m.core || saving}
                        className={`text-left p-3 rounded-xl border transition-colors ${
                          m.core
                            ? 'border-gray-700 bg-gray-800/50 cursor-default'
                            : enabled
                            ? 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15'
                            : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${enabled || m.core ? 'text-white' : 'text-gray-400'}`}>
                            {m.label}
                          </span>
                          {m.core ? (
                            <span className="text-[10px] text-gray-500">core</span>
                          ) : (
                            <span className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${enabled ? 'bg-emerald-500 justify-end' : 'bg-gray-600 justify-start'}`}>
                              <span className="w-4 h-4 rounded-full bg-white" />
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-[11px] mt-1">{m.description}</p>
                        {m.minimumPlan && (
                          <span className="text-[10px] text-purple-400 mt-1 inline-block">Requiere {m.minimumPlan}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Users */}
              {tenant.users && tenant.users.length > 0 && (
                <div>
                  <h3 className="text-white font-semibold text-sm mb-3">👥 Usuarios ({tenant.users.length})</h3>
                  <div className="space-y-1.5">
                    {tenant.users.map((u: any) => (
                      <div key={u.id} className="bg-gray-800 rounded-lg px-3 py-2 flex items-center justify-between">
                        <div>
                          <span className="text-white text-sm">{u.name}</span>
                          <span className="text-gray-500 text-xs ml-2">@{u.username}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-300">{u.role}</span>
                          {!u.active && <span className="text-[10px] text-red-400">inactivo</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-800">
              <button onClick={onClose} className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors">
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ==================== CREATE TENANT TAB (ONBOARDING) ====================

function CreateTenantTab({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({
    slug: '',
    name: '',
    businessType: 'RESTAURANT',
    plan: 'STARTER',
    adminUsername: '',
    adminPassword: '',
    adminName: '',
    phone: '',
    address: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);

  // Check slug availability on change (debounced)
  useEffect(() => {
    if (form.slug.length < 2) {
      setSlugAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await apiClient(`/admin/onboarding/check-slug/${form.slug}`);
        setSlugAvailable(data.available);
      } catch {
        setSlugAvailable(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const data = await apiClient('/admin/tenants', 'POST', form);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Error al crear el negocio');
    } finally {
      setSubmitting(false);
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    update('name', name);
    const slug = name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    update('slug', slug);
  };

  if (result) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 text-center space-y-4">
        <div className="text-4xl">🎉</div>
        <h2 className="text-xl font-bold text-green-400">¡Negocio creado exitosamente!</h2>
        <div className="text-sm text-gray-300 space-y-2">
          <p><strong>Negocio:</strong> {result.tenant.name}</p>
          <p><strong>URL:</strong> <a href={result.accessUrl} className="text-blue-400 underline">{result.accessUrl}</a></p>
          <p><strong>Admin:</strong> {result.adminUser.username}</p>
          <p><strong>Módulos:</strong> {result.tenant.enabledModules.join(', ')}</p>
        </div>
        <button
          onClick={onCreated}
          className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          Ver todos los negocios
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl p-6 space-y-5 max-w-2xl">
      <h2 className="text-lg font-medium mb-2">🧙 Nuevo Negocio</h2>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Business info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nombre del negocio *" value={form.name} onChange={(v) => handleNameChange(v)} placeholder="Barbería Mike" />
        <div>
          <Field label="Slug (URL) *" value={form.slug} onChange={(v) => update('slug', v)} placeholder="barberia-mike" />
          {form.slug.length >= 2 && (
            <p className={`text-xs mt-1 ${slugAvailable === true ? 'text-green-400' : slugAvailable === false ? 'text-red-400' : 'text-gray-500'}`}>
              {slugAvailable === true && `✅ ${form.slug}.logancorp.mx disponible`}
              {slugAvailable === false && '❌ Este slug ya está en uso'}
              {slugAvailable === null && 'Verificando...'}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Tipo de negocio *</label>
          <select value={form.businessType} onChange={(e) => update('businessType', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white">
            <option value="RESTAURANT">🍽️ Restaurante</option>
            <option value="BARBERSHOP">💈 Barbería</option>
            <option value="CAFE">☕ Cafetería</option>
            <option value="STORE">🏪 Tienda / Abarrotes</option>
            <option value="GENERAL">🏢 General</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Plan *</label>
          <select value={form.plan} onChange={(e) => update('plan', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white">
            <option value="STARTER">Starter — $500/mes</option>
            <option value="GROWTH">Growth — $1,000/mes</option>
            <option value="PRO">Pro — $1,500/mes</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Teléfono" value={form.phone} onChange={(v) => update('phone', v)} placeholder="6441234567" />
        <Field label="Dirección" value={form.address} onChange={(v) => update('address', v)} placeholder="Av. Principal #123" />
      </div>

      {/* Admin user */}
      <div className="border-t border-gray-700 pt-4 mt-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3">👤 Usuario administrador del negocio</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Nombre *" value={form.adminName} onChange={(v) => update('adminName', v)} placeholder="Miguel Hernández" />
          <Field label="Username *" value={form.adminUsername} onChange={(v) => update('adminUsername', v)} placeholder="mike" />
          <Field label="Password *" value={form.adminPassword} onChange={(v) => update('adminPassword', v)} placeholder="••••••••" type="password" />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !form.slug || !form.name || !form.adminUsername || !form.adminPassword || !form.adminName}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
      >
        {submitting ? 'Creando...' : '🚀 Crear Negocio'}
      </button>
    </form>
  );
}

// ==================== SHARED COMPONENTS ====================

function StatCard({ label, value, icon, sublabel }: { label: string; value: string | number; icon: string; sublabel?: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sublabel && <div className="text-xs text-gray-500 mt-1">{sublabel}</div>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="text-center py-8 text-red-400 text-sm">{msg}</div>
  );
}
