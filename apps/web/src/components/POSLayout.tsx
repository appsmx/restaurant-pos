import { useState } from 'react';
import Sidebar from './Sidebar';
import FloorPlan from '../pages/FloorPlan';
import MenuBrowser from '../pages/MenuBrowser';
import OrderPanel from '../pages/OrderPanel';

type View = 'floorplan' | 'menu' | 'orders';

export default function POSLayout() {
  const [activeView, setActiveView] = useState<View>('floorplan');

  const renderView = () => {
    switch (activeView) {
      case 'floorplan': return <FloorPlan />;
      case 'menu': return <MenuBrowser />;
      case 'orders': return <OrderPanel />;
    }
  };

  return (
    <div className="h-screen flex bg-gray-950 text-white">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 overflow-auto p-6">
        {renderView()}
      </main>
    </div>
  );
}