import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { useTenantStore } from './stores/tenantStore';
import Login from './pages/Login';
import POSLayout from './components/POSLayout';
import PublicMenu from './pages/PublicMenu';
import NotificationProvider from './components/NotificationProvider';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const fetchConfig = useTenantStore((s) => s.fetchConfig);
  const initialized = useTenantStore((s) => s.initialized);
  const loading = useTenantStore((s) => s.loading);
  const tenant = useTenantStore((s) => s.tenant);

  // Public route: /menu or /menu?mesa=Mesa%201 — accessible without login
  const isPublicMenu = window.location.pathname === '/menu' || window.location.search.includes('mesa=');

  // Fetch tenant config when app loads (authenticated or not)
  // This enables the login page to show the business name/logo
  useEffect(() => {
    if (!initialized && !loading) {
      fetchConfig();
    }
  }, [initialized, loading, fetchConfig]);

  if (isPublicMenu) {
    return <PublicMenu />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // Show loading while tenant config is being fetched
  if (!initialized && loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 mt-4 text-sm">
            Cargando {tenant?.name || 'negocio'}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <NotificationProvider />
      <POSLayout />
    </>
  );
}
