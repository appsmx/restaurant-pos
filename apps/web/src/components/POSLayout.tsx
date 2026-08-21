import { useState } from 'react';
import Sidebar from './Sidebar';
import FloorPlan from '../pages/FloorPlan';
import MenuBrowser from '../pages/MenuBrowser';
import OrderPanel from '../pages/OrderPanel';
import Tips from '../pages/Tips';
import Dashboard from '../pages/Dashboard';
import History from '../pages/History';
import { useAuthStore } from '../stores/authStore';

export type View = 'floorplan' | 'menu' | 'orders' | 'tips' | 'dashboard' | 'history';

export interface NavItem {
  view: View;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { view: 'floorplan', label: 'Mesas', icon: '🏗️' },
  { view: 'menu', label: 'Menú', icon: '📋' },
  { view: 'orders', label: 'Órdenes', icon: '🧾' },
  { view: 'dashboard', label: 'Dashboard', icon: '📊', adminOnly: true },
  { view: 'history', label: 'Historial', icon: '📜', adminOnly: true },
  { view: 'tips', label: 'Tips', icon: '💡' },
];

export default function POSLayout() {
  const [activeView, setActiveView] = useState<View>('floorplan');
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const visibleItems = ALL_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const renderView = () => {
    switch (activeView) {
      case 'floorplan': return <FloorPlan onViewChange={setActiveView} />;
      case 'menu': return <MenuBrowser />;
      case 'orders': return <OrderPanel />;
      case 'tips': return <Tips />;
      case 'dashboard': return isAdmin ? <Dashboard /> : <FloorPlan onViewChange={setActiveView} />;
      case 'history': return isAdmin ? <History /> : <FloorPlan onViewChange={setActiveView} />;
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-gray-950 text-white">
      {/* Sidebar — visible solo en desktop */}
      <div className="hidden md:block">
        <Sidebar activeView={activeView} onViewChange={setActiveView} navItems={visibleItems} />
      </div>

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex justify-around items-center py-2 px-1 z-50">
      {navItems.map((item) => (
        <button
          key={item.view}
          onClick={() => onViewChange(item.view)}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg min-w-[48px] transition-colors ${
            activeView === item.view
              ? 'text-blue-400'
              : 'text-gray-500'
          }`}
        >
          <span className="text-lg">{item.icon}</span>
          <span className="text-[9px] mt-0.5 font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
