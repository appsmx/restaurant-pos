import { Router } from 'express';
import multer from 'multer';
import { importService } from '../services/importService';
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

export default router;
