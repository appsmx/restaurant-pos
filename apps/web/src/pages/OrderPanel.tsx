export default function OrderPanel() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Órdenes Activas</h1>
      <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
        <p className="text-4xl mb-2">兴隆</p>
        <p>Órdenes pendientes y en proceso</p>
        <p className="text-sm mt-2">Próximo paso: conectar con GET /orders/active</p>
      </div>
    </div>
  );
}