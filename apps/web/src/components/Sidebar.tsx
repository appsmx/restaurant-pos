import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';
import { View, NavItem } from './POSLayout';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  navItems: NavItem[];
}

export default function Sidebar({ activeView, onViewChange, navItems }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const tenant = useTenantStore((s) => s.tenant);

  // Show first letter of business name or "L" for Logan
  const logoLetter = tenant?.name?.[0]?.toUpperCase() || 'L';

  return (
    <aside className="w-20 bg-gray-900 flex flex-col items-center py-4 gap-2 h-full">
      <div
        className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg mb-4"
        title={tenant?.name || 'Logan POS'}
      >
        {logoLetter}
      </div>

      {navItems.map((item) => (
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
        {/* Logan watermark */}
        <a
          href="https://logancorp.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 hover:text-gray-400 text-[9px] text-center transition-colors mb-2"
          title="Powered by Logan"
        >
          ⚡ Logan
        </a>
        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white text-sm font-bold">
          {user?.username?.[0]?.toUpperCase() || 'A'}
        </div>
        <span className="text-white text-[10px] font-medium text-center leading-tight mt-1 max-w-[70px] truncate">
          {user?.name || user?.username || 'Usuario'}
        </span>
        <span className="text-gray-500 text-[9px] capitalize">
          {user?.role?.toLowerCase() || ''}
        </span>
        <button
          onClick={logout}
          className="text-gray-500 hover:text-red-400 text-xs transition-colors mt-1"
          title="Cerrar sesión"
        >
          Salir
        </button>
      </div>
    </aside>
  );
}
