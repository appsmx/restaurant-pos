import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

interface Config {
  name: string;
  address: string | null;
  phone: string | null;
  rfc: string | null;
  taxRate: number;
  currency: string;
}

export default function Settings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [rfc, setRfc] = useState('');
  const [taxRate, setTaxRate] = useState('16');

  const fetchConfig = async () => {
    try {
      const data = await apiClient('/config', 'GET');
      setConfig(data);
      setName(data.name || '');
      setAddress(data.address || '');
      setPhone(data.phone || '');
      setRfc(data.rfc || '');
      setTaxRate(String(Math.round((data.taxRate || 0.16) * 100)));
    } catch (err) {
      // Config endpoint might not require auth
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await apiClient('/config', 'PATCH', {
        name,
        address: address || undefined,
        phone: phone || undefined,
        rfc: rfc || undefined,
        taxRate: parseFloat(taxRate) / 100,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400">Cargando configuración...</p></div>;

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-bold mb-5">⚙️ Configuración del Restaurante</h1>

      <form onSubmit={handleSave} className="max-w-lg space-y-4">
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Nombre del restaurante</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-4 py-3 focus:border-blue-500 focus:outline-none"
            placeholder="Ej: El Sazón de Jasu"
            required
          />
          <p className="text-gray-600 text-xs mt-1">Se muestra en el login y en los tickets</p>
        </div>

        <div>
          <label className="text-gray-400 text-xs mb-1 block">Dirección</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-4 py-3 focus:border-blue-500 focus:outline-none"
            placeholder="Ej: Av. Revolución 123, Col. Centro"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-4 py-3 focus:border-blue-500 focus:outline-none"
              placeholder="664 123 4567"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">RFC (para facturas)</label>
            <input
              type="text"
              value={rfc}
              onChange={(e) => setRfc(e.target.value.toUpperCase())}
              className="w-full bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-4 py-3 focus:border-blue-500 focus:outline-none"
              placeholder="XAXX010101000"
              maxLength={13}
            />
          </div>
        </div>

        <div>
          <label className="text-gray-400 text-xs mb-1 block">Tasa de IVA (%)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-24 bg-gray-800 text-white text-sm rounded-xl border border-gray-600 px-4 py-3 focus:border-blue-500 focus:outline-none text-center"
              min="0"
              max="100"
            />
            <span className="text-gray-500 text-sm">% (México: 16%)</span>
          </div>
        </div>

        <div className="pt-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-600 text-white font-bold rounded-xl transition-colors"
          >
            {saving ? 'Guardando...' : '💾 Guardar cambios'}
          </button>
          {saved && <span className="ml-3 text-emerald-400 text-sm">✅ Guardado</span>}
        </div>
      </form>

      {/* Preview */}
      <div className="mt-8 max-w-sm">
        <h2 className="text-gray-400 text-sm font-semibold mb-3">Vista previa del ticket:</h2>
        <div className="bg-white text-black rounded-xl p-5 font-mono text-xs leading-relaxed">
          <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
            <p className="font-bold text-sm">{name || 'Mi Restaurante'}</p>
            {address && <p className="text-gray-600">{address}</p>}
            {phone && <p className="text-gray-600">Tel: {phone}</p>}
            {rfc && <p className="text-gray-600">RFC: {rfc}</p>}
          </div>
          <div className="border-b border-dashed border-gray-300 pb-3 mb-3">
            <p>Ticket #001</p>
            <p>Fecha: {new Date().toLocaleDateString('es-MX')}</p>
            <p>Mesero: Juan Pérez</p>
            <p>Mesa: Mesa 3</p>
          </div>
          <div className="border-b border-dashed border-gray-300 pb-3 mb-3 space-y-1">
            <div className="flex justify-between"><span>2x Enchiladas</span><span>$240.00</span></div>
            <div className="flex justify-between"><span>1x Coca-Cola</span><span>$30.00</span></div>
            <div className="flex justify-between"><span>1x Cerveza</span><span>$55.00</span></div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between"><span>Subtotal:</span><span>$325.00</span></div>
            <div className="flex justify-between"><span>IVA ({taxRate}%):</span><span>${(325 * parseFloat(taxRate || '16') / 100).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-sm"><span>TOTAL:</span><span>${(325 * (1 + parseFloat(taxRate || '16') / 100)).toFixed(2)}</span></div>
          </div>
          <div className="text-center mt-3 pt-3 border-t border-dashed border-gray-300">
            <p className="text-gray-500">¡Gracias por su visita!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
