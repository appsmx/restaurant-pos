import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { CartModifier } from '../stores/orderStore';

interface ModifierItem {
  id: string;
  name: string;
  price: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  items: ModifierItem[];
}

interface Props {
  product: { id: string; name: string; price: number };
  onConfirm: (modifiers: CartModifier[]) => void;
  onCancel: () => void;
}

export default function ModifierModal({ product, onConfirm, onCancel }: Props) {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, number>>({}); // modifierItemId -> quantity

  useEffect(() => {
    const fetchModifiers = async () => {
      try {
        const data = await apiClient(`/modifiers/product/${product.id}`, 'GET');
        setGroups(data);
      } catch {
        // If error fetching, just add without modifiers
        onConfirm([]);
      } finally {
        setLoading(false);
      }
    };
    fetchModifiers();
  }, [product.id]);

  const toggleModifier = (group: ModifierGroup, itemId: string) => {
    setSelected((prev) => {
      const newSelected = { ...prev };
      const currentQty = newSelected[itemId] || 0;

      if (currentQty > 0) {
        // Deselect
        delete newSelected[itemId];
      } else {
        // Count how many items are currently selected in this group
        const groupItemIds = group.items.map((i) => i.id);
        const currentGroupCount = groupItemIds.reduce((sum, id) => sum + (newSelected[id] || 0), 0);

        if (group.maxSelect > 0 && currentGroupCount >= group.maxSelect) {
          // Max reached — if maxSelect is 1, replace the current selection
          if (group.maxSelect === 1) {
            for (const id of groupItemIds) {
              delete newSelected[id];
            }
            newSelected[itemId] = 1;
          }
          // Otherwise ignore (max reached)
          return prev;
        } else {
          newSelected[itemId] = 1;
        }
      }

      return newSelected;
    });
  };

  const isValid = (): boolean => {
    for (const group of groups) {
      if (group.required) {
        const groupItemIds = group.items.map((i) => i.id);
        const count = groupItemIds.reduce((sum, id) => sum + (selected[id] || 0), 0);
        if (count < Math.max(1, group.minSelect)) return false;
      }
    }
    return true;
  };

  const handleConfirm = () => {
    const modifiers: CartModifier[] = [];
    for (const group of groups) {
      for (const item of group.items) {
        const qty = selected[item.id] || 0;
        if (qty > 0) {
          modifiers.push({ id: item.id, name: item.name, price: item.price, quantity: qty });
        }
      }
    }
    onConfirm(modifiers);
  };

  // Calculate the total with selected modifiers
  const modifierTotal = groups.reduce((sum, group) => {
    return sum + group.items.reduce((gs, item) => gs + item.price * (selected[item.id] || 0), 0);
  }, 0);
  const totalPrice = product.price + modifierTotal;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
        <div className="relative bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4 border border-gray-700">
          <p className="text-gray-400 text-center">Cargando opciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-2xl w-full max-w-md mx-4 border border-gray-700 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white text-lg font-bold">{product.name}</h2>
              <p className="text-emerald-400 font-medium mt-0.5">${product.price.toFixed(2)}</p>
            </div>
            <button onClick={onCancel} className="text-gray-400 hover:text-white text-xl p-1">✕</button>
          </div>
        </div>

        {/* Modifier Groups */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          {groups.map((group) => {
            const groupItemIds = group.items.map((i) => i.id);
            const selectedCount = groupItemIds.reduce((sum, id) => sum + (selected[id] || 0), 0);

            return (
              <div key={group.id}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-semibold text-sm">{group.name}</h3>
                  <div className="flex items-center gap-2">
                    {group.required && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full font-medium">
                        Requerido
                      </span>
                    )}
                    <span className="text-gray-500 text-xs">
                      {selectedCount}/{group.maxSelect > 0 ? group.maxSelect : '∞'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const isSelected = (selected[item.id] || 0) > 0;
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleModifier(group, item.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${
                            isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-600'
                          }`}>
                            {isSelected && '✓'}
                          </span>
                          <span className={`text-sm ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
                            {item.name}
                          </span>
                        </div>
                        {item.price > 0 && (
                          <span className={`text-sm font-medium ${isSelected ? 'text-emerald-400' : 'text-gray-500'}`}>
                            +${item.price.toFixed(2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {groups.length === 0 && (
            <p className="text-gray-500 text-center text-sm">Este producto no tiene opciones adicionales</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800">
          <button
            onClick={handleConfirm}
            disabled={!isValid()}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-colors ${
              isValid()
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Agregar — ${totalPrice.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
