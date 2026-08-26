import rateLimit from 'express-rate-limit';

/**
 * Rate limiting middleware to protect against brute-force and abuse.
 *
 * Three tiers:
 *   - authLimiter: strict — for login/pin endpoints (brute-force protection)
 *   - apiLimiter: general — for all authenticated API routes
 *   - aiLimiter: moderate — for AI endpoints (cost control)
 */

// Strict limiter for auth endpoints (login, pin) — prevents brute force.
// 10 attempts per 15 minutes per IP.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiados intentos de inicio de sesión. Espera 15 minutos e intenta de nuevo.',
  },
  // Skip counting successful logins so legit users aren't penalized
  skipSuccessfulRequests: true,
});

// General API limiter — 300 requests per minute per IP.
// Generous enough for a busy POS (multiple waiters/screens polling),
// but blocks runaway scripts / scrapers.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas peticiones. Espera un momento e intenta de nuevo.',
  },
});

// AI limiter — 20 requests per minute per IP (LLM calls are expensive).
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas consultas al asistente. Espera un momento.',
  },
});
