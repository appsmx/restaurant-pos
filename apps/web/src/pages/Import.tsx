import { useState } from 'react';

interface ImportResult {
  success: boolean;
  type: string;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

type ImportType = 'items' | 'customers' | 'receipts';

const IMPORT_TYPES: { type: ImportType; label: string; icon: string; description: string; help: string }[] = [
  {
    type: 'items',
    label: 'Productos',
    icon: '📋',
    description: 'Importar catálogo de productos con categorías y precios',
    help: 'Loyverse → Back Office → Item list → Export (CSV)',
  },
  {
    type: 'customers',
    label: 'Clientes',
    icon: '👥',
    description: 'Importar base de clientes con puntos y visitas',
    help: 'Loyverse → Back Office → Customers → Export (CSV)',
  },
  {
    type: 'receipts',
    label: 'Historial de ventas',
    icon: '🧾',
    description: 'Importar recibos como órdenes cerradas (historial)',
    help: 'Loyverse → Reports → Receipts → Export → "Receipts by item" (CSV)',
  },
];

export default function Import() {
  const [selectedType, setSelectedType] = useState<ImportType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedType) return;
    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('pos_token');
      const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

      const response = await fetch(`${apiUrl}/import/${selectedType}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Error al importar');
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setResult(null);
    setError('');
    setSelectedType(null);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">🔄 Importar Datos</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">Migrar desde Loyverse POS u otro sistema (formato CSV)</p>
        </div>
      </div>

      {/* Step 1: Select import type */}
      {!selectedType && (
        <div className="space-y-3">
          <p className="text-gray-400 text-sm mb-3">¿Qué datos quieres importar?</p>
          {IMPORT_TYPES.map((imp) => (
            <button
              key={imp.type}
              onClick={() => setSelectedType(imp.type)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 text-left hover:border-blue-500/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{imp.icon}</span>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-sm group-hover:text-blue-400 transition-colors">{imp.label}</h3>
                  <p className="text-gray-400 text-xs mt-0.5">{imp.description}</p>
                  <p className="text-gray-600 text-[10px] mt-1">📂 {imp.help}</p>
                </div>
                <span className="text-gray-600 group-hover:text-blue-400 text-lg">→</span>
              </div>
            </button>
          ))}

          {/* Info box */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mt-4">
            <h3 className="text-blue-400 text-sm font-semibold mb-2">💡 ¿Cómo exportar desde Loyverse?</h3>
            <ol className="text-gray-400 text-xs space-y-1.5 list-decimal list-inside">
              <li>Inicia sesión en <a href="https://r.loyverse.com/dashboard" target="_blank" rel="noopener" className="text-blue-400 underline">Loyverse Back Office</a></li>
              <li>Para productos: Item list → botón "Export"</li>
              <li>Para clientes: Customers → botón "Export"</li>
              <li>Para ventas: Reports → Receipts → selecciona período → Export → "Receipts by item"</li>
              <li>Se descargará un archivo .csv — súbelo aquí</li>
            </ol>
          </div>
        </div>
      )}

      {/* Step 2: Upload file */}
      {selectedType && !result && (
        <div>
          <button onClick={resetForm} className="text-gray-400 hover:text-white text-xs mb-4 flex items-center gap-1">
            ← Volver a seleccionar tipo
          </button>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{IMPORT_TYPES.find((t) => t.type === selectedType)?.icon}</span>
              <div>
                <h2 className="text-white font-bold text-lg">Importar {IMPORT_TYPES.find((t) => t.type === selectedType)?.label}</h2>
                <p className="text-gray-500 text-xs">{IMPORT_TYPES.find((t) => t.type === selectedType)?.help}</p>
              </div>
            </div>

            {/* File input */}
            <div className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center hover:border-blue-500/50 transition-colors">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                {file ? (
                  <div>
                    <p className="text-3xl mb-2">📄</p>
                    <p className="text-white font-medium text-sm">{file.name}</p>
                    <p className="text-gray-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    <p className="text-blue-400 text-xs mt-2">Clic para cambiar archivo</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl mb-2">📂</p>
                    <p className="text-gray-300 text-sm font-medium">Arrastra o haz clic para seleccionar</p>
                    <p className="text-gray-500 text-xs mt-1">Archivo .csv exportado de Loyverse (máx. 10MB)</p>
                  </div>
                )}
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <p className="text-red-400 text-sm">❌ {error}</p>
              </div>
            )}

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full mt-4 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl transition-colors"
            >
              {uploading ? '⏳ Importando...' : '🚀 Importar'}
            </button>

            {/* Warning */}
            <p className="text-gray-600 text-[10px] mt-3 text-center">
              ⚠️ Los productos/clientes existentes se actualizarán (no se duplican). Las ventas se importan como órdenes cerradas.
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {result && (
        <div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="text-center mb-6">
              <p className="text-5xl mb-3">{result.errors.length === 0 ? '✅' : '⚠️'}</p>
              <h2 className="text-white font-bold text-lg">
                {result.errors.length === 0 ? '¡Importación exitosa!' : 'Importación completada con advertencias'}
              </h2>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
                <p className="text-emerald-400 font-bold text-2xl">{result.created}</p>
                <p className="text-gray-400 text-xs">Creados</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-center">
                <p className="text-blue-400 font-bold text-2xl">{result.updated}</p>
                <p className="text-gray-400 text-xs">Actualizados</p>
              </div>
              <div className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-3 text-center">
                <p className="text-gray-400 font-bold text-2xl">{result.skipped}</p>
                <p className="text-gray-400 text-xs">Omitidos</p>
              </div>
            </div>

            {/* Errors list */}
            {result.errors.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 mb-5 max-h-40 overflow-auto">
                <p className="text-red-400 text-xs font-semibold mb-2">⚠️ {result.errors.length} errores:</p>
                {result.errors.slice(0, 20).map((err, i) => (
                  <p key={i} className="text-red-300/70 text-xs">{err}</p>
                ))}
                {result.errors.length > 20 && (
                  <p className="text-gray-500 text-xs mt-1">...y {result.errors.length - 20} más</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={resetForm}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-xl transition-colors"
              >
                ← Importar más datos
              </button>
              <button
                onClick={() => { setResult(null); setFile(null); }}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                🔄 Reimportar mismo tipo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
