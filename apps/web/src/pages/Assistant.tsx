import { useState, useRef, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';

/**
 * AI Assistant — chat interface for the tenant's intelligent assistant.
 *
 * The assistant answers business questions using real data:
 * "¿Cómo van las ventas hoy?", "¿Cuál es mi producto estrella?", etc.
 */

interface PendingAction {
  type: string;
  params: Record<string, any>;
  summary?: string;
}

interface ProactiveAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  icon: string;
  title: string;
  message: string;
  action?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
  // If this assistant message proposes a write action awaiting confirmation
  confirmAction?: PendingAction;
  // Once resolved (confirmed/cancelled), hide the buttons
  actionResolved?: boolean;
}

const SUGGESTIONS = [
  '¿Cómo van las ventas hoy?',
  '¿Cuál es mi producto más vendido?',
  '¿Quiénes son mis mejores clientes?',
  '¿Cuánto vendí el 15 de este mes?',
  'Busca el producto camarón',
  'Crea el producto "Agua de Jamaica" a $25 en Bebidas',
];

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [alertsDismissed, setAlertsDismissed] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch proactive alerts on mount
  useEffect(() => {
    apiClient('/ai/alerts', 'GET')
      .then((data) => setAlerts(data.alerts || []))
      .catch(() => {});
  }, []);

  async function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg || sending) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: msg };
    const pendingMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', text: '', pending: true };

    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setInput('');
    setSending(true);

    try {
      const history = messages
        .filter((m) => !m.pending && m.text)
        .map((m) => ({ role: m.role, content: m.text }));

      const data = await apiClient('/ai/ask', 'POST', { message: msg, history });

      // If the assistant proposes a write action that needs confirmation
      const confirmAction = data.action?.needsConfirmation
        ? { type: data.action.type, params: data.action.params, summary: data.action.summary }
        : undefined;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsg.id ? { ...m, text: data.response, pending: false, confirmAction } : m
        )
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsg.id
            ? { ...m, text: err.message || 'Error al consultar el asistente', pending: false }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  async function confirmPendingAction(msgId: string, action: PendingAction, confirmed: boolean) {
    // Mark this message's action as resolved so buttons disappear
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, actionResolved: true } : m)));

    if (!confirmed) {
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: 'De acuerdo, no hice ningún cambio.' },
      ]);
      return;
    }

    const pendingMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', text: '', pending: true };
    setMessages((prev) => [...prev, pendingMsg]);
    setSending(true);
    try {
      const data = await apiClient('/ai/ask', 'POST', {
        confirmAction: { type: action.type, params: action.params },
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingMsg.id ? { ...m, text: data.response, pending: false } : m))
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsg.id
            ? { ...m, text: err.message || 'Error al ejecutar la acción', pending: false }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          🤖 Asistente IA
        </h1>
        <p className="text-gray-500 text-xs mt-1">
          Pregúntame sobre tus ventas o pídeme acciones: crear productos, buscar clientes, consultar ventas de una fecha
        </p>
      </div>

      {/* Proactive Alerts (shown when chat is empty and there are alerts) */}
      {messages.length === 0 && alerts.length > 0 && !alertsDismissed && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
              🔔 {alerts.length} {alerts.length === 1 ? 'cosa que debes saber' : 'cosas que debes saber'}
            </p>
            <button onClick={() => setAlertsDismissed(true)} className="text-xs text-gray-600 hover:text-gray-400">
              Ocultar
            </button>
          </div>
          {alerts.map((a) => {
            const styles: Record<string, string> = {
              critical: 'bg-red-500/10 border-red-500/30',
              warning: 'bg-amber-500/10 border-amber-500/30',
              info: 'bg-blue-500/10 border-blue-500/30',
              success: 'bg-green-500/10 border-green-500/30',
            };
            return (
              <div key={a.id} className={`rounded-xl border p-3 ${styles[a.severity]}`}>
                <div className="flex items-start gap-3">
                  <span className="text-lg">{a.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{a.message}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
        {messages.length === 0 && (
          <div className="text-center py-12 space-y-4">
            <div className="text-4xl">🤖</div>
            <p className="text-gray-400 text-sm">¿En qué te puedo ayudar hoy?</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-200'
              }`}
            >
              {m.pending ? (
                <span className="flex items-center gap-2 text-gray-400">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  Analizando tus datos...
                </span>
              ) : (
                m.text
              )}
            </div>

            {/* Confirmation buttons for write actions */}
            {m.confirmAction && !m.actionResolved && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => confirmPendingAction(m.id, m.confirmAction!, true)}
                  disabled={sending}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  ✓ Confirmar
                </button>
                <button
                  onClick={() => confirmPendingAction(m.id, m.confirmAction!, false)}
                  disabled={sending}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Escribe tu pregunta..."
          disabled={sending}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={() => send()}
          disabled={sending || !input.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors"
        >
          {sending ? '...' : '→'}
        </button>
      </div>
    </div>
  );
}
