import { Router } from 'express';
import { configService } from '../services/configService';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

// GET /api/config — público para cualquier usuario autenticado (necesario para mostrar nombre en login)
router.get('/', async (req, res, next) => {
  try {
    const config = await configService.getConfig();
    res.json(config);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/config — solo ADMIN puede modificar
const updateConfigSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  rfc: z.string().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  currency: z.string().optional(),
  logoUrl: z.string().optional(),
});

router.patch('/', auth, requireRole('ADMIN'), validate(updateConfigSchema), async (req, res, next) => {
  try {
    const config = await configService.updateConfig(req.body);
    res.json(config);
  } catch (error) {
    next(error);
  }
});

export default router;
