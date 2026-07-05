import { useAuthStore } from '../stores/authStore';

type View = 'floorplan' | 'menu' | 'orders';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
}

const menuItems: { view: View; label: string; icon: string }[] = [
  { view: 'floorplan', label: 'Mesas', icon: '🏗️' },
  { view: 'menu', label: 'Menú', icon: '📋' },
  { view: 'orders', label: 'Órdenes', icon: '兴隆' },
];

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className="w-20 bg-gray-900 flex flex-col items-center py-4 gap-2">
      <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg mb-4">
        P
      </div>

      {menuItems.map((item) => (
        <button
          key={item.view}
          onClick={() => onViewChange(item.view)}
          className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center text-xs transition-colors ${
            activeView === item.view
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <span className="text-lg">{item.icon}</span>
          <span className="mt-0.5">{item.label}</span>
        </button>
      ))}

      <div className="mt-auto flex flex-col items-center gap-2">
        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white text-sm font-bold">
          {user?.username?.[0]?.toUpperCase() || 'A'}
        </div>
        <button
          onClick={logout}
          className="text-gray-500 hover:text-red-400 text-xs transition-colors"
          title="Cerrar sesión"
        >
          Salir
        </button>
      </div>
    </aside>
  );
}