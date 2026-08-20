// ==================== ENUMS ====================
// Estos deben coincidir EXACTAMENTE con los enums de prisma/schema.prisma

export type Role = 'ADMIN' | 'MANAGER' | 'WAITER' | 'CASHIER' | 'CHEF';

export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export type OrderStatus = 'OPEN' | 'SENT' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CLOSED' | 'CANCELLED';

export type OrderItemStatus = 'PENDING' | 'SENT' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'DIRTY' | 'OUT_OF_SERVICE';

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export type ProductType = 'STANDARD' | 'COMBO' | 'MODIFIER';

export type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'WASTE';

// ==================== INTERFACES ====================

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  sort: number;
  active: boolean;
  products?: Product[];
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  categoryId: string;
  type: ProductType;
  active: boolean;
}

export interface Section {
  id: string;
  name: string;
  sort: number;
  tables?: Table[];
}

export interface Table {
  id: string;
  name: string;
  sectionId: string;
  capacity: number;
  status: TableStatus;
  shape: string;
  posX: number;
  posY: number;
}

export interface Order {
  id: string;
  tableId?: string | null;
  type: OrderType;
  status: OrderStatus;
  total: number;
  userId: string;
  createdAt: string;
  closedAt?: string | null;
  items?: OrderItem[];
  table?: Table | null;
  user?: Pick<User, 'name'>;
  payments?: Payment[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
  status: OrderItemStatus;
  product?: Product;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  userId: string;
  createdAt: string;
}

export interface Ingredient {
  id: string;
  name: string;
  stock: number;
  unit: string;
}

export interface StockMovement {
  id: string;
  ingredientId: string;
  type: MovementType;
  quantity: number;
  reason?: string | null;
  userId: string;
  createdAt: string;
}
