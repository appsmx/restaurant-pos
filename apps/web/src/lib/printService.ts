/**
 * Print Service — detecta si el Print Server local está corriendo
 * y envía tickets directamente. Si no está disponible, no imprime (silencioso).
 * 
 * El Print Server corre en http://localhost:9100 en la PC del restaurante.
 */

const PRINT_SERVER_URL = 'http://localhost:9100';

// Cache del estado del servidor (se verifica cada 30 segundos)
let serverAvailable: boolean | null = null;
let lastCheck = 0;
const CHECK_INTERVAL = 30000; // 30 segundos

/**
 * Verificar si el print server está corriendo
 */
export async function isPrintServerAvailable(): Promise<boolean> {
  const now = Date.now();
  if (serverAvailable !== null && now - lastCheck < CHECK_INTERVAL) {
    return serverAvailable;
  }

  try {
    const response = await fetch(`${PRINT_SERVER_URL}/status`, {
      signal: AbortSignal.timeout(2000), // timeout 2s
    });
    serverAvailable = response.ok;
  } catch {
    serverAvailable = false;
  }
  lastCheck = now;
  return serverAvailable;
}

/**
 * Enviar ticket al print server
 * @param destination - 'COCINA' | 'BARRA' | 'CAJA'
 * @param html - contenido HTML del ticket
 * @param ticketNumber - número de ticket (para log)
 * @returns true si se envió correctamente, false si falló o server no disponible
 */
export async function sendToPrintServer(
  destination: 'COCINA' | 'BARRA' | 'CAJA',
  html: string,
  ticketNumber?: number
): Promise<boolean> {
  const available = await isPrintServerAvailable();
  if (!available) return false;

  try {
    const response = await fetch(`${PRINT_SERVER_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination, html, ticketNumber }),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
