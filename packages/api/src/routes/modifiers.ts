import { Router } from 'express';
import { modifierService } from '../services/modifierService';
import { auth, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();
router.use(auth);

// ==================== SCHEMAS ====================

const createGroupSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  required: z.boolean().optional(),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
});

const createItemSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  price: z.number().min(0).optional(),
});

const assignSchema = z.object({
  modifierItemIds: z.array(z.string().uuid()),
});

// ==================== GROUPS ====================

// GET /api/modifiers — all modifier groups with items
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    // Use a default tenantId for now (single-tenant mode)
    const tenantId = (req as any).tenantId || 'default';
    const groups = await modifierService.getGroups(tenantId);
    res.json(groups);
  } catch (error) {
    next(error);
  }
});

// POST /api/modifiers/groups — create group (ADMIN/MANAGER only)
router.post('/groups', requireRole('ADMIN', 'MANAGER'), validate(createGroupSchema), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = (req as any).tenantId || 'default';
    const group = await modifierService.createGroup(tenantId, req.body);
    res.status(201).json(group);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/modifiers/groups/:id — update group
router.patch('/groups/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const group = await modifierService.updateGroup(req.params.id, req.body);
    res.json(group);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/modifiers/groups/:id — delete group
router.delete('/groups/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const result = await modifierService.deleteGroup(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== ITEMS ====================

// POST /api/modifiers/groups/:groupId/items — add item to group
router.post('/groups/:groupId/items', requireRole('ADMIN', 'MANAGER'), validate(createItemSchema), async (req: AuthRequest, res, next) => {
  try {
    const tenantId = (req as any).tenantId || 'default';
    const item = await modifierService.createItem(tenantId, req.params.groupId, req.body);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/modifiers/items/:id — update item
router.patch('/items/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const item = await modifierService.updateItem(req.params.id, req.body);
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/modifiers/items/:id — delete item
router.delete('/items/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res, next) => {
  try {
    const result = await modifierService.deleteItem(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== PRODUCT ASSIGNMENT ====================

// GET /api/modifiers/product/:productId — get modifiers for a product (grouped)
router.get('/product/:productId', async (req, res, next) => {
  try {
    const modifiers = await modifierService.getProductModifiers(req.params.productId);
    res.json(modifiers);
  } catch (error) {
    next(error);
  }
});

// PUT /api/modifiers/product/:productId — assign modifiers to product
router.put('/product/:productId', requireRole('ADMIN', 'MANAGER'), validate(assignSchema), async (req, res, next) => {
  try {
    const result = await modifierService.assignToProduct(req.params.productId, req.body.modifierItemIds);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
