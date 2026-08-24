import { create } from 'zustand';

export interface CartModifier {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
  modifiers: CartModifier[];
}

interface TableInfo {
  id: string;
  name: string;
}

interface OrderState {
  items: CartItem[];
  selectedTable: TableInfo | null;
  setSelectedTable: (table: TableInfo | null) => void;
  addItem: (product: { id: string; name: string; price: number }, notes?: string, modifiers?: CartModifier[]) => void;
  removeItem: (productId: string, notes?: string, modifiers?: CartModifier[]) => void;
  updateNotes: (productId: string, oldNotes: string, newNotes: string, modifiers?: CartModifier[]) => void;
  clearCart: () => void;
  getTotal: () => number;
}

/**
 * Generate a unique key for modifier comparison.
 * Two items with same product but different modifiers = separate line items.
 */
function modifierKey(modifiers?: CartModifier[]): string {
  if (!modifiers || modifiers.length === 0) return '';
  return modifiers
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((m) => `${m.id}:${m.quantity}`)
    .join('|');
}

function itemsMatch(item: CartItem, productId: string, notes: string, modifiers?: CartModifier[]): boolean {
  return item.id === productId && item.notes === notes && modifierKey(item.modifiers) === modifierKey(modifiers);
}

export const useOrderStore = create<OrderState>((set, get) => ({
  items: [],
  selectedTable: null,
  setSelectedTable: (table) => set({ selectedTable: table }),
  addItem: (product, notes = '', modifiers = []) => set((state) => {
    // Items with the same product AND same notes AND same modifiers stack together
    const existing = state.items.find((i) => itemsMatch(i, product.id, notes, modifiers));
    if (existing) {
      return {
        items: state.items.map((i) =>
          itemsMatch(i, product.id, notes, modifiers) ? { ...i, quantity: i.quantity + 1 } : i
        ),
      };
    }
    return { items: [...state.items, { ...product, quantity: 1, notes, modifiers }] };
  }),
  removeItem: (productId, notes = '', modifiers = []) => set((state) => ({
    items: state.items
      .map((i) => (itemsMatch(i, productId, notes, modifiers) ? { ...i, quantity: i.quantity - 1 } : i))
      .filter((i) => i.quantity > 0),
  })),
  updateNotes: (productId, oldNotes, newNotes, modifiers = []) => set((state) => ({
    items: state.items.map((i) =>
      itemsMatch(i, productId, oldNotes, modifiers) ? { ...i, notes: newNotes } : i
    ),
  })),
  clearCart: () => set({ items: [], selectedTable: null }),
  getTotal: () => get().items.reduce((sum, item) => {
    const modifierTotal = item.modifiers.reduce((ms, m) => ms + m.price * m.quantity, 0);
    return sum + (item.price + modifierTotal) * item.quantity;
  }, 0),
}));
