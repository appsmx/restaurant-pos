import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

type LoginMode = 'pin' | 'credentials';

export default function Login() {
  const [mode, setMode] = useState<LoginMode>('pin');

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-3">
            P
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white">POS Restaurante</h1>
        </div>

        {mode === 'pin' ? (
          <PinLogin onSwitchMode={() => setMode('credentials')} />
        ) : (
          <CredentialsLogin onSwitchMode={() => setMode('pin')} />
        )}
      </div>
    </div>
  );
}

// ==================== PIN LOGIN ====================

function PinLogin({ onSwitchMode }: { onSwitchMode: () => void }) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const loginWithPin = useAuthStore((s) => s.loginWithPin);

  const handleDigit = useCallback((digit: string) => {
    if (pin.length >= 4 || loading) return;
    setError('');
    const newPin = pin + digit;
    setPin(newPin);

    // Auto-submit cuando llega a 4 dígitos
    if (newPin.length === 4) {
      submitPin(newPin);
    }
  }, [pin, loading]);

  const handleDelete = useCallback(() => {
    if (loading) return;
    setPin((prev) => prev.slice(0, -1));
    setError('');
  }, [loading]);

  const submitPin = async (pinValue: string) => {
    setLoading(true);
    const success = await loginWithPin(pinValue);
    if (!success) {
      setError('PIN incorrecto');
      setShake(true);
      setTimeout(() => { setShake(false); setPin(''); }, 500);
    }
    setLoading(false);
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleDelete]);

  return (
    <div className="flex flex-col items-center">
      <p className="text-gray-400 text-sm mb-6">Ingresa tu PIN de 4 dígitos</p>

      {/* PIN Dots */}
      <div className={`flex gap-4 mb-8 ${shake ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              i < pin.length
                ? 'bg-blue-500 scale-125'
                : 'bg-gray-700 border-2 border-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-red-400 text-sm mb-4 bg-red-900/20 px-4 py-2 rounded-lg">{error}</p>
      )}

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) => {
          if (key === '') return <div key="empty" />;
          if (key === '⌫') {
            return (
              <button
                key="delete"
                onClick={handleDelete}
                disabled={loading}
                className="h-16 rounded-2xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 text-white text-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                ⌫
              </button>
            );
          }
          return (
            <button
              key={key}
              onClick={() => handleDigit(key)}
              disabled={loading}
              className="h-16 rounded-2xl bg-gray-800 hover:bg-gray-700 active:bg-blue-600 text-white text-2xl font-medium transition-colors disabled:opacity-50"
            >
              {key}
            </button>
          );
        })}
      </div>

      {/* Loading indicator */}
      {loading && (
        <p className="text-blue-400 text-sm mt-4 animate-pulse">Verificando...</p>
      )}

      {/* Switch to credentials */}
      <button
        onClick={onSwitchMode}
        className="mt-8 text-gray-500 hover:text-gray-300 text-xs transition-colors"
      >
        Usar usuario y contraseña →
      </button>
    </div>
  );
}

// ==================== CREDENTIALS LOGIN (fallback) ====================

function CredentialsLogin({ onSwitchMode }: { onSwitchMode: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await login(username, password);
    if (!success) {
      setError('Credenciales incorrectas');
    }
    setLoading(false);
  };

  return (
    <div className="bg-gray-800 p-6 rounded-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-400 text-sm mb-1">Usuario</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3.5 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-base"
            placeholder="admin"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="block text-gray-400 text-sm mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3.5 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-base"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>
        {error && <p className="text-red-400 text-sm text-center bg-red-900/20 py-2 rounded-lg">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full p-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors text-base"
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      {/* Switch to PIN */}
      <button
        onClick={onSwitchMode}
        className="w-full mt-4 text-gray-500 hover:text-gray-300 text-xs transition-colors"
      >
        ← Usar PIN rápido
      </button>
    </div>
  );
}
