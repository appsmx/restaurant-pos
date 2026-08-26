import { Router } from 'express';
import { menuService } from '../services/menuService';
import { auth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();
router.use(auth);

// ==================== SCHEMAS ====================

const createProductSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  price: z.number().positive('El precio debe ser mayor a 0'),
  categoryId: z.string().uuid('El ID de categoría debe ser un UUID válido'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  type: z.enum(['STANDARD', 'COMBO', 'MODIFIER']).optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  price: z.number().positive().optional(),
  categoryId: z.string().uuid().optional(),
  active: z.boolean().optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  sort: z.number().int().min(0).optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  sort: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

// ==================== CATEGORÍAS ====================

// GET /api/menu/categories — categorías activas con productos activos (para el POS)
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await menuService.getCategories();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// GET /api/menu/categories/all — todas las categorías (para admin)
router.get('/categories/all', requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const categories = await menuService.getAllCategories();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// POST /api/menu/categories — crear categoría
router.post('/categories', requireRole('ADMIN', 'MANAGER'), validate(createCategorySchema), async (req, res, next) => {
  try {
    const category = await menuService.createCategory(req.body);
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/menu/categories/:id — editar categoría
router.patch('/categories/:id', requireRole('ADMIN', 'MANAGER'), validate(updateCategorySchema), async (req, res, next) => {
  try {
    const category = await menuService.updateCategory(req.params.id, req.body);
    res.json(category);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/menu/categories/:id — eliminar categoría (solo si no tiene productos)
router.delete('/categories/:id', requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const result = await menuService.deleteCategory(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== PRODUCTOS ====================

// GET /api/menu/products — productos activos (para el POS)
router.get('/products', async (req, res, next) => {
  try {
    const { categoryId } = req.query;
    const products = await menuService.getProducts(categoryId as string | undefined);
    res.json(products);
  } catch (error) {
    next(error);
  }
});

// GET /api/menu/products/all — todos los productos incluyendo inactivos (para admin)
router.get('/products/all', requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { categoryId } = req.query;
    const products = await menuService.getAllProducts(categoryId as string | undefined);
    res.json(products);
  } catch (error) {
    next(error);
  }
});

// POST /api/menu/products — crear producto
router.post('/products', requireRole('ADMIN', 'MANAGER'), validate(createProductSchema), async (req: AuthRequest, res, next) => {
  try {
    const product = await menuService.createProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/menu/products/:id — editar producto
router.patch('/products/:id', requireRole('ADMIN', 'MANAGER'), validate(updateProductSchema), async (req, res, next) => {
  try {
    const product = await menuService.updateProduct(req.params.id, req.body);
    res.json(product);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/menu/products/:id — desactivar producto (soft delete)
router.delete('/products/:id', requireRole('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const result = await menuService.deleteProduct(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
