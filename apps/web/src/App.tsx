import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import POSLayout from './components/POSLayout';
import PublicMenu from './pages/PublicMenu';
import NotificationProvider from './components/NotificationProvider';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  // Public route: /menu or /menu?mesa=Mesa%201 — accessible without login
  const isPublicMenu = window.location.pathname === '/menu' || window.location.search.includes('mesa=');

  if (isPublicMenu) {
    return <PublicMenu />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <>
      <NotificationProvider />
      <POSLayout />
    </>
  );
}
