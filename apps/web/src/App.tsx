import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import POSLayout from './components/POSLayout';

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  if (!isAuthenticated) {
    return <Login />;
  }

  return <POSLayout />;
}