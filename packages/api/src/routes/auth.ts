import { Router } from 'express';
import { authService } from '../services/authService';
import { auth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loginSchema } from '../lib/validators';
import { z } from 'zod';

const router = Router();

// Schema para login con PIN
const pinLoginSchema = z.object({
  pin: z.string().length(4, 'El PIN debe ser de 4 dígitos').regex(/^\d{4}$/, 'Solo dígitos'),
});

// POST /api/auth/login — login tradicional (username + password)
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/pin — login rápido con PIN de 4 dígitos
router.post('/pin', validate(pinLoginSchema), async (req, res, next) => {
  try {
    const { pin } = req.body;
    const result = await authService.loginWithPin(pin);
    res.json(result);
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
