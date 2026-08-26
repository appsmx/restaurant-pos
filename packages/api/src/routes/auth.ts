import { Router } from 'express';
import { authService } from '../services/authService';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loginSchema } from '../lib/validators';
import { prisma } from '../lib/prisma';
import { authLimiter } from '../middleware/rateLimit';
import { z } from 'zod';

const router = Router();

// Schema para login con PIN
const pinLoginSchema = z.object({
  pin: z.string().length(4, 'El PIN debe ser de 4 dígitos').regex(/^\d{4}$/, 'Solo dígitos'),
  slug: z.string().optional(),
});

// Extended login schema (adds optional slug)
const loginWithSlugSchema = z.object({
  username: z.string().min(1, 'El usuario es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
  slug: z.string().optional(),
});

// POST /api/auth/login — login tradicional (username + password + optional slug)
router.post('/login', authLimiter, validate(loginWithSlugSchema), async (req, res, next) => {
  try {
    const { username, password, slug } = req.body;
    const result = await authService.login(username, password, slug);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/pin — login rápido con PIN (+ optional slug)
router.post('/pin', authLimiter, validate(pinLoginSchema), async (req, res, next) => {
  try {
    const { pin, slug } = req.body;
    const result = await authService.loginWithPin(pin, slug);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/tenant/:slug — resolve tenant info for login page (public)
router.get('/tenant/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, businessType: true, active: true, config: true },
    });
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Negocio no encontrado' });
    }
    if (!tenant.active) {
      return res.status(403).json({ success: false, message: 'Este negocio está desactivado' });
    }
    res.json(tenant);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', auth, async (req: AuthRequest, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || '';
    await authService.logout(token);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
