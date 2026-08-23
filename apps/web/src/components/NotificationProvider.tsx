import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from '../stores/authStore';

/**
 * NotificationProvider — polls for ready orders and shows toast + sound
 * Renders a floating notification banner when orders are ready to serve
 */
export default function NotificationProvider() {
  const [readyOrders, setReadyOrders] = useState<{ id: string; tableName: string | null; ticketNumber: number }[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const prevCount = useRef(0);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) return;

    const checkReady = async () => {
      try {
        const orders = await apiClient('/orders/active', 'GET');
        const ready = orders
          .filter((o: any) => o.status === 'READY')
          .map((o: any) => ({
            id: o.id,
            tableName: o.table?.name || null,
            ticketNumber: o.ticketNumber || 0,
          }));

        // New ready orders arrived — play sound
        if (ready.length > prevCount.current && prevCount.current >= 0) {
          playNotificationSound();
        }
        prevCount.current = ready.length;
        setReadyOrders(ready);
      } catch {
        // silent
      }
    };

    checkReady();
    const interval = setInterval(checkReady, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const visibleNotifications = readyOrders.filter((o) => !dismissed.has(o.id));

  if (visibleNotifications.length === 0) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-[90%] max-w-sm">
      {visibleNotifications.map((order) => (
        <div
          key={order.id}
          className="bg-emerald-600 text-white rounded-xl px-4 py-3 shadow-xl flex items-center justify-between animate-pulse"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <div>
              <p className="font-bold text-sm">
                ¡Orden lista! {order.tableName ? `${order.tableName}` : `Ticket #${order.ticketNumber}`}
              </p>
              <p className="text-emerald-200 text-xs">Lista para servir</p>
            </div>
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set([...prev, order.id]))}
            className="text-emerald-200 hover:text-white text-sm ml-3 shrink-0"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    // Two-tone notification (ding-dong)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.frequency.value = 659; // E5
    osc2.frequency.value = 784; // G5

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);
    osc2.start(ctx.currentTime + 0.3);
    osc2.stop(ctx.currentTime + 0.6);

    setTimeout(() => ctx.close(), 1000);
  } catch {
    // Audio not available
  }
}
