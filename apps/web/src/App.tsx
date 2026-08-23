import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import POSLayout from './components/POSLayout';
import NotificationProvider from './components/NotificationProvider';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

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
