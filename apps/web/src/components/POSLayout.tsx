import { useState } from 'react';
import Sidebar from './Sidebar';
import FloorPlan from '../pages/FloorPlan';
import MenuBrowser from '../pages/MenuBrowser';
import OrderPanel from '../pages/OrderPanel';
import Tips from '../pages/Tips';
import Dashboard from '../pages/Dashboard';
import History from '../pages/History';
import Inventory from '../pages/Inventory';
import Recipes from '../pages/Recipes';
import MenuAdmin from '../pages/MenuAdmin';
import Employees from '../pages/Employees';
import Kitchen from '../pages/Kitchen';
import Bar from '../pages/Bar';
import CashRegister from '../pages/CashRegister';
import Customers from '../pages/Customers';
import Settings from '../pages/Settings';
import { useAuthStore } from '../stores/authStore';

export type View = 'floorplan' | 'menu' | 'orders' | 'tips' | 'dashboard' | 'history' | 'inventory' | 'recipes' | 'menuadmin' | 'employees' | 'kitchen' | 'bar' | 'cash' | 'customers' | 'settings';

export interface NavItem {
  view: View;
  label: string;
  icon: string;
  roles?: string[];
}

const ALL_NAV_ITEMS: NavItem[] = [
  { view: 'floorplan', label: 'Mesas', icon: '🏗️' },
  { view: 'menu', label: 'Menú', icon: '📋' },
  { view: 'orders', label: 'Órdenes', icon: '🧾' },
  { view: 'kitchen', label: 'Cocina', icon: '👨‍🍳', roles: ['ADMIN', 'MANAGER', 'CHEF'] },
  { view: 'bar', label: 'Barra', icon: '🍺', roles: ['ADMIN', 'MANAGER', 'BARTENDER'] },
  { view: 'cash', label: 'Caja', icon: '💰', roles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { view: 'customers', label: 'Clientes', icon: '👥', roles: ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER'] },
  { view: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['ADMIN', 'MANAGER'] },
  { view: 'history', label: 'Historial', icon: '📜', roles: ['ADMIN', 'MANAGER'] },
  { view: 'inventory', label: 'Inventario', icon: '📦', roles: ['ADMIN', 'MANAGER'] },
  { view: 'recipes', label: 'Recetas', icon: '🧑‍🍳', roles: ['ADMIN', 'MANAGER'] },
  { view: 'menuadmin', label: 'Menú Admin', icon: '📝', roles: ['ADMIN', 'MANAGER'] },
  { view: 'employees', label: 'Equipo', icon: '🔑', roles: ['ADMIN'] },
  { view: 'settings', label: 'Config', icon: '⚙️', roles: ['ADMIN'] },
  { view: 'tips', label: 'Tips', icon: '💡' },
];

export default function POSLayout() {
  const [activeView, setActiveView] = useState<View>('floorplan');
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role || '';

  const visibleItems = ALL_NAV_ITEMS.filter((item) => {
    if (!item.roles) return true; // Visible para todos
    return item.roles.includes(userRole);
  });

  const isAllowed = (requiredRoles: string[]) => requiredRoles.includes(userRole);

  const renderView = () => {
    switch (activeView) {
      case 'floorplan': return <FloorPlan onViewChange={setActiveView} />;
      case 'menu': return <MenuBrowser />;
      case 'orders': return <OrderPanel />;
      case 'tips': return <Tips />;
      case 'kitchen': return <Kitchen />;
      case 'bar': return <Bar />;
      case 'cash': return isAllowed(['ADMIN', 'MANAGER', 'CASHIER']) ? <CashRegister /> : <FloorPlan onViewChange={setActiveView} />;
      case 'customers': return <Customers />;
      case 'dashboard': return isAllowed(['ADMIN', 'MANAGER']) ? <Dashboard /> : <FloorPlan onViewChange={setActiveView} />;
      case 'history': return isAllowed(['ADMIN', 'MANAGER']) ? <History /> : <FloorPlan onViewChange={setActiveView} />;
      case 'inventory': return isAllowed(['ADMIN', 'MANAGER']) ? <Inventory /> : <FloorPlan onViewChange={setActiveView} />;
      case 'recipes': return isAllowed(['ADMIN', 'MANAGER']) ? <Recipes /> : <FloorPlan onViewChange={setActiveView} />;
      case 'menuadmin': return isAllowed(['ADMIN', 'MANAGER']) ? <MenuAdmin /> : <FloorPlan onViewChange={setActiveView} />;
      case 'employees': return isAllowed(['ADMIN']) ? <Employees /> : <FloorPlan onViewChange={setActiveView} />;
      case 'settings': return isAllowed(['ADMIN']) ? <Settings /> : <FloorPlan onViewChange={setActiveView} />;
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-gray-950 text-white">
      {/* Sidebar — visible solo en desktop */}
      <div className="hidden md:block">
        <Sidebar activeView={activeView} onViewChange={setActiveView} navItems={visibleItems} />
      </div>

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6 relative">
        {/* Mobile header with user info + logout */}
        <div className="md:hidden flex items-center justify-between mb-3">
          <span className="text-gray-500 text-xs">👤 {user?.name || user?.username || 'Usuario'}</span>
          <button
            onClick={() => { useAuthStore.getState().logout(); }}
            className="text-gray-500 hover:text-red-400 text-xs px-2 py-1 rounded-lg transition-colors"
          >
            Salir ↗
          </button>
        </div>
        {renderView()}
      </main>

      {/* Bottom navigation — visible solo en móvil */}
      <BottomNav activeView={activeView} onViewChange={setActiveView} navItems={visibleItems} />
    </div>
  );
}

// ==================== Bottom Navigation (mobile) ====================

interface BottomNavProps {
  activeView: View;
  onViewChange: (view: View) => void;
  navItems: NavItem[];
}

function BottomNav({ activeView, onViewChange, navItems }: BottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-50">
      <div className="flex overflow-x-auto scrollbar-hide py-2 px-2 gap-1">
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onViewChange(item.view)}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg min-w-[56px] shrink-0 transition-colors ${
              activeView === item.view
                ? 'text-blue-400 bg-blue-500/10'
                : 'text-gray-500'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-[9px] mt-0.5 font-medium whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
