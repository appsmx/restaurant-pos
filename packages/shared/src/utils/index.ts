export function formatCurrency(amount: number, currency: string = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
}
export function roundToDecimal(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
export function calculateChange(cashGiven: number, total: number): number {
  return cashGiven < total ? 0 : cashGiven - total;
}
