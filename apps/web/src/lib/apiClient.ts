const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Get the tenant slug from the current URL.
 * Supports:
 *   - Subdomain: quiroa.logancorp.mx → "quiroa"
 *   - Path prefix: logancorp.mx/t/quiroa/... → "quiroa" (if app is mounted there)
 *   - localStorage fallback: set during login response
 *
 * Returns null if no tenant can be determined (dev/single-tenant mode).
 */
function getTenantSlug(): string | null {
  // Strategy 1: Check localStorage (set after successful login)
  const stored = localStorage.getItem('pos_tenant_slug');
  if (stored) return stored;

  // Strategy 2: Extract from subdomain
  const hostname = window.location.hostname;
  const knownBases = ['logancorp.mx', 'logancorp.vercel.app', 'localhost'];
  for (const base of knownBases) {
    if (hostname.endsWith(`.${base}`)) {
      const subdomain = hostname.slice(0, -(base.length + 1)).split('.')[0];
      if (subdomain && !['www', 'api', 'admin', 'app'].includes(subdomain)) {
        return subdomain;
      }
    }
  }

  return null;
}

export const apiClient = async (endpoint: string, method: string = 'GET', body: any = null) => {
  const token = localStorage.getItem('pos_token');
  const tenantSlug = getTenantSlug();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Include tenant slug header for multi-tenant resolution
  if (tenantSlug) {
    headers['X-Tenant-Slug'] = tenantSlug;
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(API_URL + endpoint, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Error en la petición');
  }

  return data;
};

/**
 * Set the tenant slug in localStorage.
 * Called after login when the API returns the tenantId/slug.
 */
export function setTenantSlug(slug: string): void {
  localStorage.setItem('pos_tenant_slug', slug);
}

/**
 * Clear the tenant slug from localStorage.
 * Called on logout.
 */
export function clearTenantSlug(): void {
  localStorage.removeItem('pos_tenant_slug');
}
