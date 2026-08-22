import { Router } from 'express';
import { userService } from '../services/userService';
import { auth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();
router.use(auth);
router.use(requireRole('ADMIN'));

// Schemas
const createUserSchema = z.object({
  username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  name: z.string().min(1, 'El nombre es obligatorio'),
  role: z.enum(['ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'CHEF']),
});

const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'WAITER', 'CASHIER', 'CHEF']),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

// GET /api/users — listar todos los usuarios
router.get('/', async (req, res, next) => {
  try {
    const users = await userService.getUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// POST /api/users — crear usuario nuevo
router.post('/', validate(createUserSchema), async (req, res, next) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:id/toggle — activar/desactivar usuario
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const user = await userService.toggleUserActive(req.params.id);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:id/role — cambiar rol
router.patch('/:id/role', validate(updateRoleSchema), async (req, res, next) => {
  try {
    const user = await userService.updateUserRole(req.params.id, req.body.role);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/:id/password — resetear contraseña
router.patch('/:id/password', validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const result = await userService.resetPassword(req.params.id, req.body.password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
