import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { fmtQty } from '../lib/format';

interface Ingredient {
  id: string;
  name: string;
  stock: number;
  unit: string;
  _count: { recipes: number };
}

type ModalType = 'none' | 'addIngredient' | 'addMovement';
type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'WASTE';

const MOVEMENT_LABELS: Record<MovementType, { label: string; icon: string; color: string }> = {
  IN: { label: 'Entrada', icon: '📥', color: 'text-emerald-400' },
  OUT: { label: 'Salida', icon: '📤', color: 'text-red-400' },
  ADJUSTMENT: { label: 'Ajuste', icon: '🔧', color: 'text-blue-400' },
  WASTE: { label: 'Desperdicio', icon: '🗑️', color: 'text-orange-400' },
};

const LOW_STOCK_THRESHOLD = 10;
const CRITICAL_STOCK_THRESHOLD = 3;

export default function Inventory() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<ModalType>('none');
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);

  // Form states
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('UNIT');
  const [newStock, setNewStock] = useState('0');
  const [movType, setMovType] = useState<MovementType>('IN');
  const [movQuantity, setMovQuantity] = useState('');
  const [movReason, setMovReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const data = await apiClient('/inventory/ingredients', 'GET');
      setIngredients(data);
    } catch (err) {
      setError('Error al cargar el inventario. Verifica permisos de administrador.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
  }, []);

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient('/inventory/ingredients', 'POST', {
        name: newName,
        unit: newUnit,
        stock: parseFloat(newStock) || 0,
      });
      setModal('none');
      setNewName('');
      setNewUnit('UNIT');
      setNewStock('0');
      fetchIngredients();
    } catch (err) {
      alert('Error al crear ingrediente');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient) return;
    setSubmitting(true);
    try {
      await apiClient('/inventory/movements', 'POST', {
        ingredientId: selectedIngredient.id,
        type: movType,
        quantity: parseFloat(movQuantity),
        reason: movReason || undefined,
      });
      setModal('none');
      setMovQuantity('');
      setMovReason('');
      setSelectedIngredient(null);
      fetchIngredients();
    } catch (err) {
      alert('Error al registrar movimiento');
    } finally {
      setSubmitting(false);
    }
  };

  const openMovementModal = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setMovType('IN');
    setMovQuantity('');
    setMovReason('');
    setModal('addMovement');
  };

  const getStockColor = (stock: number) => {
    if (stock <= CRITICAL_STOCK_THRESHOLD) return 'text-red-400';
    if (stock <= LOW_STOCK_THRESHOLD) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getStockBg = (stock: number) => {
    if (stock <= CRITICAL_STOCK_THRESHOLD) return 'bg-red-500/10 border-red-500/30';
    if (stock <= LOW_STOCK_THRESHOLD) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-gray-800 border-gray-700';
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400 text-lg">Cargando inventario...</p></div>;
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-red-400 text-lg text-center px-4">{error}</p></div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">📦 Inventario</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">{ingredients.length} ingredientes registrados</p>
        </div>
        <button
          onClick={() => setModal('addIngredient')}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors"
        >
          ➕ Nuevo ingrediente
        </button>
      </div>

      {/* Low stock alert */}
      {ingredients.filter((i) => i.stock <= LOW_STOCK_THRESHOLD).length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
          <p className="text-amber-400 text-sm font-medium">
            ⚠️ {ingredients.filter((i) => i.stock <= LOW_STOCK_THRESHOLD).length} ingrediente(s) con stock bajo
          </p>
        </div>
      )}

      {/* Ingredients grid */}
      {ingredients.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
          <p className="text-3xl mb-2">📦</p>
          <p>No hay ingredientes registrados</p>
          <p className="text-xs mt-1">Agrega tu primer ingrediente para empezar a controlar el stock</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ingredients.map((ingredient) => (
            <div
              key={ingredient.id}
              className={`rounded-xl border p-4 transition-colors ${getStockBg(ingredient.stock)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium text-sm md:text-base truncate">{ingredient.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`font-bold text-lg ${getStockColor(ingredient.stock)}`}>
                      {fmtQty(ingredient.stock)}
                    </span>
                    <span className="text-gray-500 text-xs">{ingredient.unit}</span>
                  </div>
                  {ingredient._count.recipes > 0 && (
                    <p className="text-gray-500 text-xs mt-1">
                      🔗 En {ingredient._count.recipes} {ingredient._count.recipes === 1 ? 'receta' : 'recetas'}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => openMovementModal(ingredient)}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-xs rounded-lg transition-colors shrink-0"
                >
                  ±Stock
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ==================== MODAL: Nuevo Ingrediente ==================== */}
      {modal === 'addIngredient' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal('none')} />
          <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-700">
            <h2 className="text-white font-bold text-lg mb-4">➕ Nuevo ingrediente</h2>
            <form onSubmit={handleAddIngredient} className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Nombre</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Tomate"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Stock inicial</label>
                  <input
                    type="number"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                    min="0"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Unidad</label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="UNIT">Unidades</option>
                    <option value="KG">Kilogramos</option>
                    <option value="G">Gramos</option>
                    <option value="L">Litros</option>
                    <option value="ML">Mililitros</option>
                    <option value="PZ">Piezas</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModal('none')}
                  className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newName}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {submitting ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: Registrar Movimiento ==================== */}
      {modal === 'addMovement' && selectedIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal('none')} />
          <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-700">
            <h2 className="text-white font-bold text-lg mb-1">±Stock</h2>
            <p className="text-gray-400 text-sm mb-4">
              {selectedIngredient.name} — Stock actual: <span className={getStockColor(selectedIngredient.stock)}>{fmtQty(selectedIngredient.stock)} {selectedIngredient.unit}</span>
            </p>
            <form onSubmit={handleAddMovement} className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">Tipo de movimiento</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(MOVEMENT_LABELS) as MovementType[]).map((type) => {
                    const info = MOVEMENT_LABELS[type];
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setMovType(type)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                          movType === type
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {info.icon} {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">
                  {movType === 'ADJUSTMENT' ? 'Nuevo valor de stock' : 'Cantidad'}
                </label>
                <input
                  type="number"
                  value={movQuantity}
                  onChange={(e) => setMovQuantity(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder={movType === 'ADJUSTMENT' ? 'Valor absoluto' : 'Cantidad'}
                  min="0"
                  step="0.1"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Razón (opcional)</label>
                <input
                  type="text"
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Compra semanal, Se echó a perder..."
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModal('none')}
                  className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !movQuantity}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {submitting ? 'Guardando...' : '✓ Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
