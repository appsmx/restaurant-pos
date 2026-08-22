import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  active: boolean;
  createdAt: string;
  _count: { orders: number };
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ADMIN: { label: 'Administrador', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  MANAGER: { label: 'Gerente', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  WAITER: { label: 'Mesero', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  CASHIER: { label: 'Cajero', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  CHEF: { label: 'Cocinero', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
};

const ROLES = ['ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'CHEF'];

export default function Employees() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('WAITER');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiClient('/users', 'GET');
      setUsers(data);
    } catch (err) {
      setError('Error al cargar los usuarios. Verifica permisos de administrador.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient('/users', 'POST', {
        name: newName,
        username: newUsername,
        password: newPassword,
        role: newRole,
      });
      setShowCreate(false);
      setNewName('');
      setNewUsername('');
      setNewPassword('');
      setNewRole('WAITER');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Error al crear usuario');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (userId: string) => {
    try {
      await apiClient(`/users/${userId}/toggle`, 'PATCH');
      fetchUsers();
    } catch (err) {
      alert('Error al cambiar estado del usuario');
    }
  };

  const handleChangeRole = async (userId: string, role: string) => {
    try {
      await apiClient(`/users/${userId}/role`, 'PATCH', { role });
      fetchUsers();
    } catch (err) {
      alert('Error al cambiar rol');
    }
  };

  const [pinModal, setPinModal] = useState<string | null>(null);
  const [pinValue, setPinValue] = useState('');

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModal) return;
    try {
      await apiClient(`/users/${pinModal}/pin`, 'PATCH', { pin: pinValue });
      alert('✅ PIN asignado correctamente');
      setPinModal(null);
      setPinValue('');
    } catch (err: any) {
      alert(err.message || 'Error al asignar PIN');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-lg">Cargando usuarios...</p></div>;
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-red-400 text-lg text-center px-4">{error}</p></div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">👥 Empleados</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">{users.length} usuarios registrados</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors"
        >
          ➕ Nuevo empleado
        </button>
      </div>

      {/* Users list */}
      <div className="space-y-3">
        {users.map((user) => {
          const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.WAITER;
          return (
            <div
              key={user.id}
              className={`bg-gray-800 rounded-xl border border-gray-700 p-4 ${!user.active ? 'opacity-50' : ''}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* User info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                    {user.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">{user.name}</span>
                      {!user.active && <span className="text-red-400 text-xs">(Inactivo)</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gray-500 text-xs">@{user.username}</span>
                      <span className="text-gray-600 text-xs">·</span>
                      <span className="text-gray-500 text-xs">{user._count.orders} órdenes</span>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 ml-13 sm:ml-0">
                  {/* Role selector */}
                  <select
                    value={user.role}
                    onChange={(e) => handleChangeRole(user.id, e.target.value)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border ${roleInfo.color} bg-transparent font-medium`}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r} className="bg-gray-800 text-white">
                        {ROLE_LABELS[r]?.label || r}
                      </option>
                    ))}
                  </select>

                  {/* Toggle active */}
                  <button
                    onClick={() => handleToggleActive(user.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      user.active
                        ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                  >
                    {user.active ? 'Desactivar' : 'Activar'}
                  </button>

                  {/* Assign PIN */}
                  <button
                    onClick={() => { setPinModal(user.id); setPinValue(''); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
                  >
                    🔢 PIN
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Crear empleado */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-700">
            <h2 className="text-white font-bold text-lg mb-4">➕ Nuevo empleado</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Nombre completo</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Usuario (para login)</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: juanperez"
                  minLength={3}
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Rol</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]?.label || r}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newName || !newUsername || !newPassword}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {submitting ? 'Creando...' : 'Crear empleado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Asignar PIN */}
      {pinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPinModal(null)} />
          <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-xs border border-gray-700 text-center">
            <h2 className="text-white font-bold text-lg mb-2">🔢 Asignar PIN</h2>
            <p className="text-gray-400 text-sm mb-4">Este PIN se usará para login rápido (4 dígitos)</p>
            <form onSubmit={handleSetPin} className="space-y-4">
              <input
                type="text"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full bg-gray-800 text-white text-2xl rounded-xl border border-gray-600 px-4 py-3 focus:border-blue-500 focus:outline-none text-center font-bold tracking-[0.5em]"
                placeholder="• • • •"
                maxLength={4}
                inputMode="numeric"
                autoFocus
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setPinModal(null)} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl">Cancelar</button>
                <button type="submit" disabled={pinValue.length !== 4} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm font-bold rounded-xl">
                  Guardar PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leyenda de roles */}
      <div className="mt-6 bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h3 className="text-gray-300 text-sm font-semibold mb-2">📖 ¿Qué puede hacer cada rol?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-400">
          <div><span className="text-purple-400 font-medium">Admin:</span> Todo el sistema sin restricciones</div>
          <div><span className="text-blue-400 font-medium">Gerente:</span> Todo excepto gestión de empleados</div>
          <div><span className="text-amber-400 font-medium">Cajero:</span> Cobrar, caja, clientes, órdenes</div>
          <div><span className="text-emerald-400 font-medium">Mesero:</span> Mesas, menú, tomar pedidos, clientes</div>
          <div><span className="text-orange-400 font-medium">Cocinero:</span> Pantalla de cocina (ver y completar pedidos)</div>
        </div>
      </div>
    </div>
  );
}
