import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { resolveTenant } from './middleware/resolveTenant';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: permitir frontend local y producción
// Also allow tenant subdomains (*.logancorp.mx)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      return callback(null, true);
    }
    // En producción, permitir cualquier .vercel.app y subdominios de logancorp.mx
    if (origin.endsWith('.vercel.app') || origin.endsWith('.logancorp.mx')) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true,
}));

app.use(express.json());

// Health check endpoint (Render lo usa para verificar que el servicio está vivo)
// This runs BEFORE tenant resolution — health checks don't need a tenant.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== TENANT RESOLUTION ====================
// Runs before ALL /api routes. Detects tenant from:
//   1. X-Tenant-Slug header (API clients)
//   2. Subdomain (quiroa.logancorp.mx)
//   3. Path prefix (/t/quiroa/api/...)
//
// In development (NODE_ENV=development or ALLOW_NO_TENANT=true), passes through
// without tenant for backward compat with existing single-tenant setup.
app.use('/api', resolveTenant, routes);

// Also support /t/:slug/api/... paths (resolveTenant strips the prefix)
app.use('/t', resolveTenant, routes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 POS API corriendo en puerto ${PORT}`);
});
