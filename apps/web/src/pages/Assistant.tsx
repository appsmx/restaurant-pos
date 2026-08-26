import { useState, useRef, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';

/**
 * AI Assistant — chat interface for the tenant's intelligent assistant.
 *
 * The assistant answers business questions using real data:
 * "¿Cómo van las ventas hoy?", "¿Cuál es mi producto estrella?", etc.
 */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
}

const SUGGESTIONS = [
  '¿Cómo van las ventas hoy?',
  '¿Cuál es mi producto más vendido?',
  '¿Quiénes son mis mejores clientes?',
  'Dame un resumen de esta semana',
  '¿Qué me recomiendas mejorar?',
];

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

      setMessages((prev) =>
        prev.map((m) => (m.id === pendingMsg.id ? { ...m, text: data.response, pending: false } : m))
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

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          🤖 Asistente IA
        </h1>
        <p className="text-gray-500 text-xs mt-1">
          Pregúntame sobre tus ventas, productos, clientes o pide recomendaciones
        </p>
      </div>

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
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
