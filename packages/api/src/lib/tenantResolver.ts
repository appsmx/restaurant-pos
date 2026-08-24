/**
 * Tenant Resolver — resolves a tenant from the incoming request context.
 *
 * Resolution strategies (tried in order):
 *   1. X-Tenant-Slug header (for API clients / mobile apps)
 *   2. Subdomain: quiroa.logancorp.mx → slug = "quiroa"
 *   3. Path prefix: logancorp.mx/quiroa/api/... → slug = "quiroa"
 *
 * Includes an in-memory cache to avoid hitting the DB on every request.
 * Cache TTL: 60 seconds (short enough that tenant deactivation takes effect quickly).
 *
 * This module is pure logic — no Express dependency. The middleware in
 * resolveTenant.ts uses this to extract the slug and resolve the tenant.
 */

import { prisma } from './prisma';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ResolvedTenant {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  businessType: string;
  plan: string;
  enabledModules: string[];
  config: any;
}

// ─── In-memory cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  tenant: ResolvedTenant | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const tenantCache = new Map<string, CacheEntry>();

function getCached(slug: string): ResolvedTenant | null | undefined {
  const entry = tenantCache.get(slug);
  if (!entry) return undefined; // not in cache
  if (Date.now() > entry.expiresAt) {
    tenantCache.delete(slug);
    return undefined; // expired
  }
  return entry.tenant; // cached (may be null = slug doesn't exist)
}

function setCache(slug: string, tenant: ResolvedTenant | null): void {
  tenantCache.set(slug, {
    tenant,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Clear the tenant cache. Useful for admin operations that change tenant state.
 */
export function clearTenantCache(slug?: string): void {
  if (slug) {
    tenantCache.delete(slug);
  } else {
    tenantCache.clear();
  }
}

// ─── Slug extraction from request ────────────────────────────────────────────

/**
 * Known base domains where Logan POS is deployed.
 * Subdomains of these are treated as tenant slugs.
 * Add more as you deploy to new domains.
 */
const BASE_DOMAINS = [
  'logancorp.mx',
  'logancorp.vercel.app',
  'localhost',
];

/**
 * Extract tenant slug from the hostname (subdomain strategy).
 *
 * Examples:
 *   quiroa.logancorp.mx      → "quiroa"
 *   mike.logancorp.mx        → "mike"
 *   logancorp.mx             → null (no subdomain)
 *   localhost                 → null (development, no subdomain)
 *   quiroa.localhost          → "quiroa" (local development)
 *   api.logancorp.mx         → null (reserved subdomain)
 *   www.logancorp.mx         → null (reserved subdomain)
 */
export function extractSlugFromHostname(hostname: string): string | null {
  // Remove port if present (localhost:3001 → localhost)
  const host = hostname.split(':')[0];

  // Check against each base domain
  for (const base of BASE_DOMAINS) {
    if (host === base) return null; // exact match = no subdomain

    if (host.endsWith(`.${base}`)) {
      // Extract the subdomain part
      const subdomain = host.slice(0, -(base.length + 1)); // remove ".domain.com"

      // Skip reserved subdomains
      if (RESERVED_SUBDOMAINS.has(subdomain)) return null;

      // If there are multiple levels (a.b.logancorp.mx), only take first
      const slug = subdomain.split('.')[0];
      return slug || null;
    }
  }

  // Unknown domain — can't extract slug
  return null;
}

/** Subdomains that are NOT tenant slugs */
const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'dashboard',
  'docs',
  'mail',
  'status',
]);

/**
 * Extract tenant slug from the URL path (path prefix strategy).
 *
 * Only activates for paths that start with /t/:slug/
 * This avoids conflicts with existing API routes.
 *
 * Examples:
 *   /t/quiroa/api/orders    → "quiroa"
 *   /t/mike/api/menu        → "mike"
 *   /api/orders             → null (no tenant prefix)
 *   /health                 → null (no tenant prefix)
 */
export function extractSlugFromPath(path: string): string | null {
  // Pattern: /t/:slug/...
  const match = path.match(/^\/t\/([a-z0-9_-]+)\//i);
  if (match) return match[1].toLowerCase();
  return null;
}

/**
 * Extract tenant slug from the X-Tenant-Slug header.
 * Used by API clients, mobile apps, and admin tools.
 */
export function extractSlugFromHeader(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const slug = headerValue.trim().toLowerCase();
  // Validate slug format (alphanumeric, hyphens, underscores, 2-50 chars)
  if (/^[a-z0-9_-]{2,50}$/.test(slug)) return slug;
  return null;
}

// ─── Full resolution ─────────────────────────────────────────────────────────

/**
 * Resolve a tenant by slug — checks cache first, then DB.
 * Returns null if the slug doesn't match any tenant.
 */
export async function resolveTenantBySlug(slug: string): Promise<ResolvedTenant | null> {
  // Check cache first
  const cached = getCached(slug);
  if (cached !== undefined) return cached;

  // Query DB (no tenant context needed — Tenant model is excluded from filtering)
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      active: true,
      businessType: true,
      plan: true,
      enabledModules: true,
      config: true,
    },
  });

  const resolved: ResolvedTenant | null = tenant
    ? {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        active: tenant.active,
        businessType: tenant.businessType,
        plan: tenant.plan,
        enabledModules: tenant.enabledModules,
        config: tenant.config,
      }
    : null;

  // Cache the result (even null — to avoid repeated DB misses for invalid slugs)
  setCache(slug, resolved);
  return resolved;
}

/**
 * Extract slug from the request using all strategies (header → subdomain → path).
 *
 * Priority order:
 *   1. X-Tenant-Slug header (highest — explicit, used by API clients)
 *   2. Subdomain (quiroa.logancorp.mx)
 *   3. Path prefix (/t/quiroa/...)
 *
 * Returns the slug string or null if no tenant could be determined.
 */
export function extractSlugFromRequest(
  hostname: string,
  path: string,
  tenantHeader?: string
): string | null {
  // Strategy 1: Header
  const fromHeader = extractSlugFromHeader(tenantHeader);
  if (fromHeader) return fromHeader;

  // Strategy 2: Subdomain
  const fromSubdomain = extractSlugFromHostname(hostname);
  if (fromSubdomain) return fromSubdomain;

  // Strategy 3: Path prefix
  const fromPath = extractSlugFromPath(path);
  if (fromPath) return fromPath;

  return null;
}
