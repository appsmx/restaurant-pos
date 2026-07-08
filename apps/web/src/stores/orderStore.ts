import { create } from 'zustand';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface TableInfo {
  id: string;
  name: string;
}

interface OrderState {
  items: CartItem[];
  selectedTable: TableInfo | null;
  setSelectedTable: (table: TableInfo | null) => void;
  addItem: (product: { id: string; name: string; price: number }) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  items: [],
  selectedTable: null,
  setSelectedTable: (table) => set({ selectedTable: table }),
  addItem: (product) => set((state) => {
    const existing = state.items.find((i) => i.id === product.id);
    if (existing) {
      return {
        items: state.items.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        ),
      };
    }
    return { items: [...state.items, { ...product, quantity: 1 }] };
  }),
  removeItem: (productId) => set((state) => ({
    items: state.items
      .map((i) => (i.id === productId ? { ...i, quantity: i.quantity - 1 } : i))
      .filter((i) => i.quantity > 0),
  })),
  clearCart: () => set({ items: [], selectedTable: null }),
  getTotal: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
}));