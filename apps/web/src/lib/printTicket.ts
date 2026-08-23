/**
 * Genera e imprime un ticket de venta en una ventana nueva
 */
interface TicketData {
  ticketNumber: number;
  date: string;
  waiterName: string;
  tableName: string | null;
  items: { name: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  paymentMethod: string;
  restaurant: {
    name: string;
    address?: string | null;
    phone?: string | null;
    rfc?: string | null;
  };
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

export function printTicket(data: TicketData) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ticket #${data.ticketNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 5mm; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .separator { border-top: 1px dashed #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .items { margin: 5px 0; }
    .total { font-size: 14px; font-weight: bold; }
    .footer { margin-top: 10px; font-size: 10px; color: #666; }
    @media print {
      body { width: 80mm; margin: 0; padding: 3mm; }
    }
  </style>
</head>
<body>
  <div class="center">
    <p class="bold" style="font-size:14px">${data.restaurant.name}</p>
    ${data.restaurant.address ? `<p>${data.restaurant.address}</p>` : ''}
    ${data.restaurant.phone ? `<p>Tel: ${data.restaurant.phone}</p>` : ''}
    ${data.restaurant.rfc ? `<p>RFC: ${data.restaurant.rfc}</p>` : ''}
  </div>
  
  <div class="separator"></div>
  
  <div>
    <div class="row"><span>Ticket:</span><span>#${String(data.ticketNumber).padStart(3, '0')}</span></div>
    <div class="row"><span>Fecha:</span><span>${data.date}</span></div>
    <div class="row"><span>Atendió:</span><span>${data.waiterName}</span></div>
    ${data.tableName ? `<div class="row"><span>Mesa:</span><span>${data.tableName}</span></div>` : ''}
  </div>
  
  <div class="separator"></div>
  
  <div class="items">
    ${data.items.map(item => `
      <div class="row">
        <span>${item.quantity}x ${item.name}</span>
        <span>$${(item.quantity * item.unitPrice).toFixed(2)}</span>
      </div>
    `).join('')}
  </div>
  
  <div class="separator"></div>
  
  <div>
    <div class="row"><span>Subtotal:</span><span>$${data.subtotal.toFixed(2)}</span></div>
    <div class="row"><span>IVA (${Math.round(data.taxRate * 100)}%):</span><span>$${data.tax.toFixed(2)}</span></div>
    <div class="row total"><span>TOTAL:</span><span>$${data.total.toFixed(2)}</span></div>
  </div>
  
  <div class="separator"></div>
  
  <div class="row"><span>Método:</span><span>${METHOD_LABELS[data.paymentMethod] || data.paymentMethod}</span></div>
  
  <div class="separator"></div>
  
  <div class="center footer">
    <p>¡Gracias por su visita!</p>
    <p>${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
  </div>
  
  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=350,height=600');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
