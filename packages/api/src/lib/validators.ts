import { z } from 'zod';

// ==================== AUTH ====================
export const loginSchema = z.object({
  username: z.string().min(1, 'El usuario es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

// ==================== MENU ====================
export const createProductSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  price: z.number().positive('El precio debe ser mayor a 0'),
  categoryId: z.string().uuid('El ID de categoría debe ser un UUID válido'),
  description: z.string().optional(),
  type: z.enum(['STANDARD', 'COMBO', 'MODIFIER']).optional(),
});

// ==================== ORDERS ====================
export const createOrderSchema = z.object({
  tableId: z.string().uuid('El ID de mesa debe ser un UUID válido').optional().nullable(),
  type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).optional(),
});

export const addOrderItemSchema = z.object({
  productId: z.string().uuid('El ID de producto debe ser un UUID válido'),
  quantity: z.number().int().positive('La cantidad debe ser al menos 1'),
  notes: z.string().optional(),
  modifiers: z.array(z.object({
    modifierId: z.string().uuid(),
    quantity: z.number().int().positive().optional().default(1),
  })).optional(),
});

export const payOrderSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']).optional().default('CASH'),
  customerId: z.string().uuid().optional().nullable(),
});

// ==================== FLOORPLAN ====================
export const updateTableStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY', 'OUT_OF_SERVICE'], {
    errorMap: () => ({ message: 'Estado de mesa inválido. Valores: AVAILABLE, OCCUPIED, RESERVED, DIRTY, OUT_OF_SERVICE' }),
  }),
});
