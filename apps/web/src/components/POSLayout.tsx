import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import FloorPlan from '../pages/FloorPlan';
import MenuBrowser from '../pages/MenuBrowser';
import OrderPanel from '../pages/OrderPanel';
import Tips from '../pages/Tips';
import Dashboard from '../pages/Dashboard';
import History from '../pages/History';
import Inventory from '../pages/Inventory';
import Recipes from '../pages/Recipes';
import Modifiers from '../pages/Modifiers';
import MenuAdmin from '../pages/MenuAdmin';
import Employees from '../pages/Employees';
import Kitchen from '../pages/Kitchen';
import Bar from '../pages/Bar';
import CashRegister from '../pages/CashRegister';
import Customers from '../pages/Customers';
import Settings from '../pages/Settings';
import Reservations from '../pages/Reservations';
import { useAuthStore } from '../stores/authStore';
import { useTenantStore } from '../stores/tenantStore';

export type View = 'floorplan' | 'menu' | 'orders' | 'tips' | 'dashboard' | 'history' | 'inventory' | 'recipes' | 'modifiers' | 'menuadmin' | 'employees' | 'kitchen' | 'bar' | 'cash' | 'customers' | 'settings' | 'reservations';

export interface NavItem {
  view: View;
  label: string;
  icon: string;
  roles?: string[];
  /** Module ID that must be enabled for this nav item to show */
  moduleId?: string;
}

/**
 * Navigation items with module mapping.
 * Items with a moduleId will only show if that module is enabled for the tenant.
 * Items without moduleId are always shown (core functionality).
 */
const ALL_NAV_ITEMS: NavItem[] = [
  { view: 'floorplan', label: 'Mesas', icon: '🏗️', moduleId: 'floorPlan' },
  { view: 'menu', label: 'Menú', icon: '📋', moduleId: 'pos' },
  { view: 'orders', label: 'Órdenes', icon: '🧾', moduleId: 'pos' },
  { view: 'kitchen', label: 'Cocina', icon: '👨‍🍳', roles: ['ADMIN', 'MANAGER', 'CHEF'], moduleId: 'kitchen' },
  { view: 'bar', label: 'Barra', icon: '🍺', roles: ['ADMIN', 'MANAGER', 'BARTENDER'], moduleId: 'bar' },
  { view: 'cash', label: 'Caja', icon: '💰', roles: ['ADMIN', 'MANAGER', 'CASHIER'], moduleId: 'cash' },
  { view: 'customers', label: 'Clientes', icon: '👥', roles: ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER'], moduleId: 'customers' },
  { view: 'reservations', label: 'Reservas', icon: '📅', roles: ['ADMIN', 'MANAGER', 'WAITER'], moduleId: 'appointments' },
  { view: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['ADMIN', 'MANAGER'], moduleId: 'reports' },
  { view: 'history', label: 'Historial', icon: '📜', roles: ['ADMIN', 'MANAGER'], moduleId: 'reports' },
  { view: 'inventory', label: 'Inventario', icon: '📦', roles: ['ADMIN', 'MANAGER'], moduleId: 'inventory' },
  { view: 'recipes', label: 'Recetas', icon: '🧑‍🍳', roles: ['ADMIN', 'MANAGER'], moduleId: 'recipes' },
  { view: 'modifiers', label: 'Extras', icon: '🧩', roles: ['ADMIN', 'MANAGER'], moduleId: 'modifiers' },
  { view: 'menuadmin', label: 'Menú Admin', icon: '📝', roles: ['ADMIN', 'MANAGER'], moduleId: 'pos' },
  { view: 'employees', label: 'Equipo', icon: '🔑', roles: ['ADMIN'], moduleId: 'users' },
  { view: 'settings', label: 'Config', icon: '⚙️', roles: ['ADMIN'], moduleId: 'config' },
  { view: 'tips', label: 'Tips', icon: '💡' },
];

export default function POSLayout() {
  const [activeView, setActiveView] = useState<View>('floorplan');
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role || '';

  // Tenant-aware module filtering
  const isModuleEnabled = useTenantStore((s) => s.isModuleEnabled);
  const t = useTenantStore((s) => s.t);
  const terminology = useTenantStore((s) => s.terminology);

  // Apply terminology to labels dynamically
  const getLabel = (item: NavItem): string => {
    if (!terminology) return item.label;
    // Map specific views to terminology keys
    const labelMap: Partial<Record<View, keyof typeof terminology>> = {
      floorplan: 'tables',
      menu: 'menu',
      orders: 'orders',
      kitchen: 'kitchen',
      customers: 'customers',
      reservations: 'reservations',
      inventory: 'inventory',
    };
    const termKey = labelMap[item.view];
    if (termKey && terminology[termKey]) {
      // Capitalize first letter
      const term = terminology[termKey];
      return term.charAt(0).toUpperCase() + term.slice(1);
    }
    return item.label;
  };

  // Filter by role AND by enabled modules
  const visibleItems = ALL_NAV_ITEMS.filter((item) => {
    // Role check
    if (item.roles && !item.roles.includes(userRole)) return false;
    // Module check
    if (item.moduleId && !isModuleEnabled(item.moduleId)) return false;
    return true;
  }).map(item => ({
    ...item,
    label: getLabel(item),
  }));

  // If the active view's module got disabled, redirect to first available
  useEffect(() => {
    const activeItem = ALL_NAV_ITEMS.find(i => i.view === activeView);
    if (activeItem?.moduleId && !isModuleEnabled(activeItem.moduleId)) {
      const firstVisible = visibleItems[0];
      if (firstVisible) setActiveView(firstVisible.view);
    }
  }, [activeView, isModuleEnabled]);

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
      case 'reservations': return isAllowed(['ADMIN', 'MANAGER', 'WAITER']) ? <Reservations /> : <FloorPlan onViewChange={setActiveView} />;
      case 'dashboard': return isAllowed(['ADMIN', 'MANAGER']) ? <Dashboard /> : <FloorPlan onViewChange={setActiveView} />;
      case 'history': return isAllowed(['ADMIN', 'MANAGER']) ? <History /> : <FloorPlan onViewChange={setActiveView} />;
      case 'inventory': return isAllowed(['ADMIN', 'MANAGER']) ? <Inventory /> : <FloorPlan onViewChange={setActiveView} />;
      case 'recipes': return isAllowed(['ADMIN', 'MANAGER']) ? <Recipes /> : <FloorPlan onViewChange={setActiveView} />;
      case 'modifiers': return isAllowed(['ADMIN', 'MANAGER']) ? <Modifiers /> : <FloorPlan onViewChange={setActiveView} />;
      case 'menuadmin': return isAllowed(['ADMIN', 'MANAGER']) ? <MenuAdmin /> : <FloorPlan onViewChange={setActiveView} />;
      case 'employees': return isAllowed(['ADMIN']) ? <Employees /> : <FloorPlan onViewChange={setActiveView} />;
      case 'settings': return isAllowed(['ADMIN']) ? <Settings /> : <FloorPlan onViewChange={setActiveView} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-950 text-white">
      {/* Sidebar — visible solo en desktop */}
      <div className="hidden md:block">
        <Sidebar activeView={activeView} onViewChange={setActiveView} navItems={visibleItems} />
      </div>

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6 relative">
        {/* Mobile header with user info + logout */}
        <div className="md:hidden flex items-center justify-between mb-3">
          <span className="text-gray-500 text-xs">👤 {user?.name || user?.username || 'Usuario'} <span className="text-gray-600">· {user?.role?.toLowerCase()}</span></span>
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
