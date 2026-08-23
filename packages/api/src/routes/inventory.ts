import { Router } from 'express';
import { inventoryService } from '../services/inventoryService';
import { recipeService } from '../services/recipeService';
import { auth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();
router.use(auth);
router.use(requireRole('ADMIN', 'MANAGER'));

// ==================== SCHEMAS ====================

const createIngredientSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  stock: z.number().min(0).optional(),
  unit: z.string().min(1).optional(),
});

const updateIngredientSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
});

const createMovementSchema = z.object({
  ingredientId: z.string().uuid('ID de ingrediente inválido'),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'WASTE']),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  reason: z.string().optional(),
});

const addRecipeIngredientSchema = z.object({
  ingredientId: z.string().uuid('ID de ingrediente inválido'),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
});

const setRecipeSchema = z.object({
  ingredients: z.array(z.object({
    ingredientId: z.string().uuid(),
    quantity: z.number().positive(),
  })).min(1, 'La receta debe tener al menos un ingrediente'),
});

// ==================== INGREDIENTES ====================

// GET /api/inventory/ingredients
router.get('/ingredients', async (req, res, next) => {
  try {
    const ingredients = await inventoryService.getIngredients();
    res.json(ingredients);
  } catch (error) {
    next(error);
  }
});

// GET /api/inventory/ingredients/:id
router.get('/ingredients/:id', async (req, res, next) => {
  try {
    const ingredient = await inventoryService.getIngredientById(req.params.id);
    res.json(ingredient);
  } catch (error) {
    next(error);
  }
});

// POST /api/inventory/ingredients
router.post('/ingredients', validate(createIngredientSchema), async (req, res, next) => {
  try {
    const ingredient = await inventoryService.createIngredient(req.body);
    res.status(201).json(ingredient);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/inventory/ingredients/:id
router.patch('/ingredients/:id', validate(updateIngredientSchema), async (req, res, next) => {
  try {
    const ingredient = await inventoryService.updateIngredient(req.params.id, req.body);
    res.json(ingredient);
  } catch (error) {
    next(error);
  }
});

// ==================== MOVIMIENTOS DE STOCK ====================

// GET /api/inventory/movements?ingredientId=&limit=50
router.get('/movements', async (req, res, next) => {
  try {
    const { ingredientId, limit } = req.query;
    const movements = await inventoryService.getMovements(
      ingredientId as string | undefined,
      limit ? parseInt(limit as string) : 50
    );
    res.json(movements);
  } catch (error) {
    next(error);
  }
});

// POST /api/inventory/movements
router.post('/movements', validate(createMovementSchema), async (req: AuthRequest, res, next) => {
  try {
    const result = await inventoryService.createMovement({
      ...req.body,
      userId: req.userId!,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== RECETAS ====================

// GET /api/inventory/recipes/:productId
router.get('/recipes/:productId', async (req, res, next) => {
  try {
    const recipe = await recipeService.getRecipeByProduct(req.params.productId);
    res.json(recipe);
  } catch (error) {
    next(error);
  }
});

// POST /api/inventory/recipes/:productId/ingredients
router.post('/recipes/:productId/ingredients', validate(addRecipeIngredientSchema), async (req, res, next) => {
  try {
    const { ingredientId, quantity } = req.body;
    const result = await recipeService.addIngredientToRecipe(req.params.productId, ingredientId, quantity);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// PUT /api/inventory/recipes/:productId (reemplazar receta completa)
router.put('/recipes/:productId', validate(setRecipeSchema), async (req, res, next) => {
  try {
    const result = await recipeService.setRecipe(req.params.productId, req.body.ingredients);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/inventory/recipes/items/:recipeIngredientId
router.delete('/recipes/items/:recipeIngredientId', async (req, res, next) => {
  try {
    const result = await recipeService.removeIngredientFromRecipe(req.params.recipeIngredientId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/inventory/alerts — ingredientes con stock bajo
router.get('/alerts', async (req, res, next) => {
  try {
    const threshold = req.query.threshold ? parseFloat(req.query.threshold as string) : 10;
    const alerts = await inventoryService.getLowStockAlerts(threshold);
    res.json(alerts);
  } catch (error) {
    next(error);
  }
});

export default router;
