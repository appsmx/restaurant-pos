import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

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
  modifiers: ModifierItem[];
}

export default function Modifiers() {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Group form
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupRequired, setGroupRequired] = useState(false);
  const [groupMax, setGroupMax] = useState('1');
  const [editingGroup, setEditingGroup] = useState<string | null>(null);

  // Item form
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await apiClient('/modifiers', 'GET');
      setGroups(data);
    } catch (err) {
      setError('Error al cargar modificadores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGroups(); }, []);

  // ==================== GROUP ACTIONS ====================

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingGroup) {
        await apiClient(`/modifiers/groups/${editingGroup}`, 'PATCH', {
          name: groupName, required: groupRequired, maxSelect: parseInt(groupMax) || 1,
        });
      } else {
        await apiClient('/modifiers/groups', 'POST', {
          name: groupName, required: groupRequired, maxSelect: parseInt(groupMax) || 1,
        });
      }
      setShowGroupForm(false);
      setEditingGroup(null);
      setGroupName(''); setGroupRequired(false); setGroupMax('1');
      fetchGroups();
    } catch (err: any) {
      alert(err.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditGroup = (g: ModifierGroup) => {
    setGroupName(g.name);
    setGroupRequired(g.required);
    setGroupMax(String(g.maxSelect));
    setEditingGroup(g.id);
    setShowGroupForm(true);
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!confirm(`¿Eliminar grupo "${name}" y todos sus modificadores?`)) return;
    try {
      await apiClient(`/modifiers/groups/${groupId}`, 'DELETE');
      fetchGroups();
    } catch (err: any) { alert(err.message || 'Error'); }
  };

  // ==================== ITEM ACTIONS ====================

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingToGroup) return;
    setSubmitting(true);
    try {
      await apiClient(`/modifiers/groups/${addingToGroup}/items`, 'POST', {
        name: itemName, price: parseFloat(itemPrice) || 0,
      });
      setAddingToGroup(null);
      setItemName(''); setItemPrice('0');
      fetchGroups();
    } catch (err: any) { alert(err.message || 'Error'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await apiClient(`/modifiers/items/${itemId}`, 'DELETE');
      fetchGroups();
    } catch (err: any) { alert(err.message || 'Error'); }
  };

  // ==================== RENDER ====================

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Cargando modificadores...</p></div>;
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-red-400">{error}</p></div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">🧩 Modificadores</h1>
          <p className="text-gray-500 text-xs mt-0.5">Extras, opciones y personalizaciones para tus productos</p>
        </div>
        <button
          onClick={() => { setShowGroupForm(true); setEditingGroup(null); setGroupName(''); setGroupRequired(false); setGroupMax('1'); }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          ➕ Nuevo grupo
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 text-xs text-blue-400">
        <p><strong>¿Cómo funciona?</strong> Crea grupos de opciones (ej: "Término", "Extras") y agrega modificadores a cada grupo (ej: "Medio $0", "Queso extra $20"). Luego asígnalos a productos desde Menú Admin.</p>
      </div>

      {/* Groups */}
      {groups.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
          <p className="text-3xl mb-2">🧩</p>
          <p>No hay grupos de modificadores</p>
          <p className="text-xs mt-1">Crea tu primer grupo: "Extras", "Término", "Tamaño"...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              {/* Group header */}
              <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                <div>
                  <span className="text-white font-medium text-sm">{group.name}</span>
                  <div className="flex gap-2 mt-0.5">
                    {group.required && <span className="text-amber-400 text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded">Obligatorio</span>}
                    <span className="text-gray-500 text-[10px]">Máx: {group.maxSelect} selección{group.maxSelect > 1 ? 'es' : ''}</span>
                    <span className="text-gray-500 text-[10px]">· {group.modifiers.length} opciones</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setAddingToGroup(group.id)} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg">➕</button>
                  <button onClick={() => openEditGroup(group)} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg">✏️</button>
                  <button onClick={() => handleDeleteGroup(group.id, group.name)} className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded-lg">🗑️</button>
                </div>
              </div>

              {/* Items */}
              {group.modifiers.length === 0 ? (
                <p className="px-4 py-3 text-gray-500 text-xs">Sin opciones aún — presiona ➕ para agregar</p>
              ) : (
                <div className="divide-y divide-gray-700/50">
                  {group.modifiers.map((item) => (
                    <div key={item.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm">{item.name}</span>
                        {item.price > 0 && <span className="text-emerald-400 text-xs font-medium">+${item.price}</span>}
                        {item.price === 0 && <span className="text-gray-600 text-xs">Gratis</span>}
                      </div>
                      <button onClick={() => handleDeleteItem(item.id)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Crear/Editar Grupo */}
      {showGroupForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowGroupForm(false)} />
          <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-700">
            <h2 className="text-white font-bold text-lg mb-4">{editingGroup ? '✏️ Editar grupo' : '➕ Nuevo grupo'}</h2>
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Nombre del grupo</label>
                <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Extras, Término, Tamaño..." required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Máx selecciones</label>
                  <input type="number" value={groupMax} onChange={(e) => setGroupMax(e.target.value)}
                    className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                    min="1" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={groupRequired} onChange={(e) => setGroupRequired(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-800 text-blue-600 w-4 h-4" />
                    Obligatorio
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowGroupForm(false)} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl">Cancelar</button>
                <button type="submit" disabled={submitting || !groupName} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-xl">
                  {submitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Agregar Item */}
      {addingToGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAddingToGroup(null)} />
          <div className="relative bg-gray-900 rounded-2xl p-5 w-full max-w-sm border border-gray-700">
            <h2 className="text-white font-bold text-lg mb-4">➕ Nueva opción</h2>
            <form onSubmit={handleAddItem} className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Nombre</label>
                <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Queso extra, Bien cocido, Grande..." required />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Precio adicional ($)</label>
                <input type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)}
                  className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="0 = gratis" min="0" step="5" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setAddingToGroup(null)} className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl">Cancelar</button>
                <button type="submit" disabled={submitting || !itemName} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-xl">
                  {submitting ? 'Agregando...' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
