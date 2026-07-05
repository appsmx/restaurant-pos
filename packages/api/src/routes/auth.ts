import { Router } from 'express';
import { authService } from '../services/authService';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

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