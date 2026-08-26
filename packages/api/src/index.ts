import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { initSocket } from './lib/socket';
import { apiLimiter } from './middleware/rateLimit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust the first proxy (Render/Vercel) so rate-limit sees real client IPs
app.set('trust proxy', 1);

// CORS: permitir frontend local y producción
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
    // En producción, permitir cualquier .vercel.app
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true,
}));

app.use(express.json());

// Health check endpoint (Render lo usa para verificar que el servicio está vivo)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// General rate limit on all API routes (brute-force / abuse protection)
app.use('/api', apiLimiter, routes);

app.use(errorHandler);

// Create HTTP server and attach Socket.IO
const httpServer = createServer(app);
initSocket(httpServer, allowedOrigins);

httpServer.listen(PORT, () => {
  console.log(`🚀 POS API corriendo en puerto ${PORT}`);
  console.log(`🔌 WebSocket activo`);
});
