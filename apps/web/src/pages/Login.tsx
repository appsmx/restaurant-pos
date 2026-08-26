import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../lib/apiClient';

type LoginMode = 'pin' | 'credentials';

interface TenantData {
  id: string;
  slug: string;
  name: string;
  businessType: string;
  config: any;
}

export default function Login() {
  const [mode, setMode] = useState<LoginMode>('pin');
  const [tenantData, setTenantData] = useState<TenantData | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState('');
  const [showSlugInput, setShowSlugInput] = useState(false);
  const [slugInput, setSlugInput] = useState('');
  const { tenantSlug, setTenantSlug } = useAuthStore();

  // Resolve tenant from URL param (?t=slug) or stored slug
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSlug = params.get('t') || params.get('tenant') || params.get('slug');

    const effectiveSlug = urlSlug || tenantSlug;

    if (effectiveSlug) {
      resolveTenant(effectiveSlug);
    }
  }, []);

  const resolveTenant = async (slug: string) => {
    setTenantLoading(true);
    setTenantError('');
    try {
      const data = await apiClient(`/auth/tenant/${slug}`, 'GET');
      setTenantData(data);
      setTenantSlug(slug);
      setShowSlugInput(false);
    } catch (err: any) {
      setTenantError(err.message || 'Negocio no encontrado');
      setTenantData(null);
    } finally {
      setTenantLoading(false);
    }
  };

  const handleSlugSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (slugInput.trim()) {
      resolveTenant(slugInput.trim().toLowerCase());
    }
  };

  const handleChangeTenant = () => {
    setTenantData(null);
    setTenantSlug(null);
    setShowSlugInput(true);
    setTenantError('');
  };

  // Determine display name
  const displayName = tenantData?.name || 'POS Restaurante';
  const effectiveSlug = tenantData?.slug || tenantSlug || undefined;

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-3 shadow-lg shadow-blue-600/20">
            {displayName[0]?.toUpperCase() || 'P'}
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white">{displayName}</h1>
          {tenantData && (
            <button
              onClick={handleChangeTenant}
              className="text-gray-500 hover:text-gray-300 text-xs mt-1 transition-colors"
            >
              {tenantData.slug} · cambiar ↗
            </button>
          )}
        </div>

        {/* Tenant loading */}
        {tenantLoading && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Conectando...</p>
          </div>
        )}

        {/* Slug input (when no tenant is set or user wants to change) */}
        {!tenantData && !tenantLoading && (showSlugInput || !tenantSlug) && (
          <div className="bg-gray-800 p-6 rounded-2xl mb-4">
            <p className="text-gray-300 text-sm text-center mb-4">¿A qué negocio quieres entrar?</p>
            <form onSubmit={handleSlugSubmit} className="space-y-3">
              <input
                type="text"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                className="w-full p-3.5 bg-gray-700 text-white rounded-xl border border-gray-600 focus:border-blue-500 focus:outline-none text-center text-lg font-mono"
                placeholder="mi-negocio"
                autoFocus
              />
              {tenantError && (
                <p className="text-red-400 text-sm text-center bg-red-900/20 py-2 rounded-lg">{tenantError}</p>
              )}
              <button
                type="submit"
                disabled={!slugInput.trim()}
                className="w-full p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-medium transition-colors"
              >
                Continuar →
              </button>
            </form>
            <p className="text-gray-600 text-[10px] text-center mt-3">
              Ingresa el identificador de tu negocio (ej: quiroa, mi-cafe)
            </p>
          </div>
        )}

        {/* Login form (only when tenant is resolved or no slug required) */}
        {(tenantData || (!showSlugInput && !tenantSlug)) && !tenantLoading && (
          <>
            {mode === 'pin' ? (
              <PinLogin onSwitchMode={() => setMode('credentials')} slug={effectiveSlug} />
            ) : (
              <CredentialsLogin onSwitchMode={() => setMode('pin')} slug={effectiveSlug} />
            )}
          </>
        )}

        {/* Logan watermark */}
        <div className="mt-8 text-center">
          <a
            href="https://logancorp.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
          >
            ⚡ Powered by Logan
          </a>
        </div>
      </div>
    </div>
  );
}

// ==================== PIN LOGIN ====================

function PinLogin({ onSwitchMode, slug }: { onSwitchMode: () => void; slug?: string }) {
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
    const success = await loginWithPin(pinValue, slug);
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

function CredentialsLogin({ onSwitchMode, slug }: { onSwitchMode: () => void; slug?: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await login(username, password, slug);
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
