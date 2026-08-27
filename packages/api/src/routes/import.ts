import { Router } from 'express';
import multer from 'multer';
import { importService } from '../services/importService';
import { loyverseApiService } from '../services/loyverseApiService';
import { auth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const router = Router();
router.use(auth);
router.use(requireRole('ADMIN'));

// Multer config: store files in memory (CSV files are small)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos CSV'));
    }
  },
});

// POST /api/import/items — importar productos desde Loyverse CSV
router.post('/items', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se recibió archivo CSV' });
    }
    const csvContent = req.file.buffer.toString('utf-8');
    const result = await importService.importItems(csvContent);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// POST /api/import/customers — importar clientes desde Loyverse CSV
router.post('/customers', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se recibió archivo CSV' });
    }
    const csvContent = req.file.buffer.toString('utf-8');
    const result = await importService.importCustomers(csvContent);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// POST /api/import/receipts — importar historial de ventas desde Loyverse CSV
router.post('/receipts', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se recibió archivo CSV' });
    }
    const csvContent = req.file.buffer.toString('utf-8');
    const result = await importService.importReceipts(csvContent, req.userId!);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// ==================== IMPORTACIÓN VÍA API DE LOYVERSE ====================
// El usuario provee su Access Token de Loyverse (Back Office → Integraciones → Access tokens).
// No requiere exportar/subir CSV: los datos se obtienen directo de la API.

// POST /api/import/loyverse/test — validar token consultando el comercio
router.post('/loyverse/test', async (req: AuthRequest, res, next) => {
  try {
    const { token } = req.body || {};
    const info = await loyverseApiService.testConnection(token);
    res.json({ success: true, ...info });
  } catch (error) {
    next(error);
  }
});

// POST /api/import/loyverse/items — importar productos + categorías vía API
router.post('/loyverse/items', async (req: AuthRequest, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ success: false, message: 'Falta el token de Loyverse' });
    const result = await loyverseApiService.importItems(token);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// POST /api/import/loyverse/customers — importar clientes vía API
router.post('/loyverse/customers', async (req: AuthRequest, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ success: false, message: 'Falta el token de Loyverse' });
    const result = await loyverseApiService.importCustomers(token);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// POST /api/import/loyverse/receipts — importar historial de ventas vía API
router.post('/loyverse/receipts', async (req: AuthRequest, res, next) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ success: false, message: 'Falta el token de Loyverse' });
    const result = await loyverseApiService.importReceipts(token, req.userId!);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
