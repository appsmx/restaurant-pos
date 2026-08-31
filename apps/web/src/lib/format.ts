/**
 * Formatea una cantidad a máximo 1 decimal, evitando el ruido de punto flotante.
 * Ej: 4.000000001 → "4", 3.56 → "3.6", 2.830000000000001 → "2.8"
 */
export function fmtQty(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '0';
  return parseFloat(n.toFixed(1)).toString();
}
