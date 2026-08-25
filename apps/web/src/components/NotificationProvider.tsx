import { useEffect, useState, useCallback } from 'react';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../stores/authStore';

interface OrderNotification {
  id: string;
  ticketNumber: number;
  tableName?: string;
  waiterName?: string;
  timestamp: number;
}

/**
 * NotificationProvider — sits at the root of the app and listens for order:ready events.
 * Shows toast notifications + plays sound + browser notification when the current user's order is ready.
 */
export default function NotificationProvider() {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const user = useAuthStore((s) => s.user);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleOrderReady = (data: { orderId: string; ticketNumber: number; tableName?: string; userId?: string; waiterName?: string }) => {
      // Show notification to everyone (all roles benefit from knowing orders are ready)
      // But highlight specifically if it's YOUR order (you created it)
      const isMyOrder = user?.id && data.userId === user.id;
      const role = user?.role || '';

      // Show to: the waiter who created it, all cashiers (they need to know it's ready to serve/charge), managers, admins
      const shouldNotify = isMyOrder || ['CASHIER', 'ADMIN', 'MANAGER'].includes(role);
      if (!shouldNotify) return;

      const notification: OrderNotification = {
        id: data.orderId + '-' + Date.now(),
        ticketNumber: data.ticketNumber,
        tableName: data.tableName,
        waiterName: data.waiterName,
        timestamp: Date.now(),
      };

      setNotifications((prev) => [notification, ...prev].slice(0, 5)); // Max 5 visible

      // Play notification sound
      playNotificationSound();

      // Browser notification (if permitted)
      if ('Notification' in window && Notification.permission === 'granted') {
        const title = isMyOrder ? '🍽️ ¡Tu orden está lista!' : '🍽️ Orden lista';
        const body = `Ticket #${data.ticketNumber}${data.tableName ? ` — ${data.tableName}` : ''}${!isMyOrder && data.waiterName ? ` (${data.waiterName})` : ''}`;
        try {
          new Notification(title, { body, icon: '/icon-192.png', tag: data.orderId });
        } catch { /* Notification API not available */ }
      }

      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      }, 10000);
    };

    socket.on('order:ready', handleOrderReady);
    return () => { socket.off('order:ready', handleOrderReady); };
  }, [user]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
      {notifications.map((notif) => {
        const isMyOrder = user?.id && notif.waiterName === user.name;
        return (
          <div
            key={notif.id}
            className={`rounded-xl border p-4 shadow-2xl animate-slide-in backdrop-blur-sm ${
              isMyOrder
                ? 'bg-emerald-900/90 border-emerald-500/50'
                : 'bg-gray-900/90 border-gray-600/50'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🍽️</span>
                <div>
                  <p className={`text-sm font-bold ${isMyOrder ? 'text-emerald-300' : 'text-white'}`}>
                    {isMyOrder ? '¡Tu orden está lista!' : 'Orden lista para servir'}
                  </p>
                  <p className="text-gray-300 text-xs mt-0.5">
                    Ticket #{notif.ticketNumber}
                    {notif.tableName && ` — ${notif.tableName}`}
                    {!isMyOrder && notif.waiterName && ` (${notif.waiterName})`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => dismissNotification(notif.id)}
                className="text-gray-400 hover:text-white text-sm shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ==================== Sound ====================

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Two-tone notification (more noticeable than single beep)
    osc.frequency.value = 660;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);

    // Second tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 880;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.4, ctx.currentTime + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc2.start(ctx.currentTime + 0.18);
    osc2.stop(ctx.currentTime + 0.5);

    setTimeout(() => ctx.close(), 700);
  } catch {
    // Audio not available
  }
}
