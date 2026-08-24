import { create } from 'zustand';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
}

interface TableInfo {
  id: string;
  name: string;
}

interface OrderState {
  items: CartItem[];
  selectedTable: TableInfo | null;
  setSelectedTable: (table: TableInfo | null) => void;
  addItem: (product: { id: string; name: string; price: number }, notes?: string) => void;
  removeItem: (productId: string, notes?: string) => void;
  updateNotes: (productId: string, oldNotes: string, newNotes: string) => void;
  clearCart: () => void;
  getTotal: () => number;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  items: [],
  selectedTable: null,
  setSelectedTable: (table) => set({ selectedTable: table }),
  addItem: (product, notes = '') => set((state) => {
    // Items with the same product AND same notes stack together
    const existing = state.items.find((i) => i.id === product.id && i.notes === notes);
    if (existing) {
      return {
        items: state.items.map((i) =>
          i.id === product.id && i.notes === notes ? { ...i, quantity: i.quantity + 1 } : i
        ),
      };
    }
    return { items: [...state.items, { ...product, quantity: 1, notes }] };
  }),
  removeItem: (productId, notes = '') => set((state) => ({
    items: state.items
      .map((i) => (i.id === productId && i.notes === notes ? { ...i, quantity: i.quantity - 1 } : i))
      .filter((i) => i.quantity > 0),
  })),
  updateNotes: (productId, oldNotes, newNotes) => set((state) => ({
    items: state.items.map((i) =>
      i.id === productId && i.notes === oldNotes ? { ...i, notes: newNotes } : i
    ),
  })),
  clearCart: () => set({ items: [], selectedTable: null }),
  getTotal: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
}));
