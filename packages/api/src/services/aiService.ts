import { prisma } from '../lib/prisma';

/**
 * AI Assistant Service — per-tenant intelligent assistant.
 *
 * Builds context from the tenant's real data (sales, products, customers)
 * and calls an LLM to answer business questions.
 *
 * Uses Gemini (free tier) as default, with env-based configuration.
 * The assistant speaks in the business's voice, not Logan's.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface AskOptions {
  tenantId: string;
  message: string;
  history?: { role: string; content: string }[];
}

interface AskResult {
  response: string;
  provider: string;
}

// ─── LLM Call ────────────────────────────────────────────────────────────────

async function callLLM(systemPrompt: string, userMessage: string, history?: { role: string; content: string }[]): Promise<{ text: string; provider: string }> {
  // Try DeepSeek first (cheapest), then Gemini (free), then OpenAI, then Z.ai
  const providers = [
    { name: 'deepseek', key: process.env.DEEPSEEK_API_KEY },
    { name: 'gemini', key: process.env.GEMINI_API_KEY },
    { name: 'openai', key: process.env.OPENAI_API_KEY },
    { name: 'zai', key: process.env.ZAI_API_KEY },
  ];

  for (const provider of providers) {
    if (!provider.key) continue;

    try {
      if (provider.name === 'deepseek') {
        return await callDeepSeek(provider.key, systemPrompt, userMessage, history);
      } else if (provider.name === 'gemini') {
        return await callGemini(provider.key, systemPrompt, userMessage, history);
      } else if (provider.name === 'openai') {
        return await callOpenAI(provider.key, systemPrompt, userMessage, history);
      } else if (provider.name === 'zai') {
        return await callZai(provider.key, systemPrompt, userMessage, history);
      }
    } catch (e) {
      console.warn(`[ai] ${provider.name} failed:`, (e as Error).message);
      continue;
    }
  }

  throw new Error('No hay proveedor de IA disponible. Configura DEEPSEEK_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, o ZAI_API_KEY.');
}

async function callDeepSeek(apiKey: string, systemPrompt: string, userMessage: string, history?: { role: string; content: string }[]): Promise<{ text: string; provider: string }> {
  const messages: any[] = [{ role: 'system', content: systemPrompt }];
  if (history) messages.push(...history);
  messages.push({ role: 'user', content: userMessage });

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: 2048, temperature: 0.7 }),
  });

  if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('DeepSeek empty response');
  return { text, provider: 'deepseek' };
}

async function callGemini(apiKey: string, systemPrompt: string, userMessage: string, history?: { role: string; content: string }[]): Promise<{ text: string; provider: string }> {
  const contents: any[] = [];
  if (history) {
    for (const msg of history) {
      contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] });
    }
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini empty response');
  return { text, provider: 'gemini' };
}

async function callOpenAI(apiKey: string, systemPrompt: string, userMessage: string, history?: { role: string; content: string }[]): Promise<{ text: string; provider: string }> {
  const messages: any[] = [{ role: 'system', content: systemPrompt }];
  if (history) messages.push(...history);
  messages.push({ role: 'user', content: userMessage });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 2048, temperature: 0.7 }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content || '', provider: 'openai' };
}

async function callZai(apiKey: string, systemPrompt: string, userMessage: string, history?: { role: string; content: string }[]): Promise<{ text: string; provider: string }> {
  const messages: any[] = [{ role: 'system', content: systemPrompt }];
  if (history) messages.push(...history);
  messages.push({ role: 'user', content: userMessage });

  const res = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'glm-5-turbo', messages, max_tokens: 2048, temperature: 0.7 }),
  });

  if (!res.ok) throw new Error(`Z.ai ${res.status}`);
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content || '', provider: 'zai' };
}

// ─── Context Builder ─────────────────────────────────────────────────────────

async function buildTenantContext(tenantId: string): Promise<string> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  // Parallel queries for speed
  const [tenant, todayOrders, weekOrders, topProducts, recentCustomers, productCount] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.order.findMany({
      where: { tenantId, createdAt: { gte: todayStart }, status: { in: ['CLOSED', 'DELIVERED'] } },
      select: { total: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { tenantId, createdAt: { gte: weekStart }, status: { in: ['CLOSED', 'DELIVERED'] } },
      select: { total: true },
    }),
    prisma.orderItem.findMany({
      where: { tenantId, order: { createdAt: { gte: weekStart }, status: { in: ['CLOSED', 'DELIVERED'] } } },
      select: { productId: true, quantity: true, product: { select: { name: true, price: true } } },
    }),
    prisma.customer.findMany({
      where: { tenantId },
      orderBy: { totalSpent: 'desc' },
      take: 5,
      select: { firstName: true, lastName: true, totalVisits: true, totalSpent: true },
    }),
    prisma.product.count({ where: { tenantId, active: true } }),
  ]);

  if (!tenant) return 'No se encontró información del negocio.';

  // Calculate stats
  const todayTotal = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const todayCount = todayOrders.length;
  const weekTotal = weekOrders.reduce((sum, o) => sum + o.total, 0);
  const weekCount = weekOrders.length;

  // Top products (aggregate by productId)
  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  for (const item of topProducts) {
    const key = item.productId;
    if (!productSales[key]) productSales[key] = { name: item.product.name, qty: 0, revenue: 0 };
    productSales[key].qty += item.quantity;
    productSales[key].revenue += item.quantity * item.product.price;
  }
  const top5 = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 5);

  const lines = [
    `## Datos de ${tenant.name}`,
    `- Tipo: ${tenant.businessType}`,
    `- Productos activos: ${productCount}`,
    '',
    `## Ventas de hoy (${todayStart.toLocaleDateString('es-MX')})`,
    `- Total: $${todayTotal.toLocaleString()} MXN`,
    `- Órdenes: ${todayCount}`,
    `- Ticket promedio: $${todayCount > 0 ? Math.round(todayTotal / todayCount).toLocaleString() : 0}`,
    '',
    `## Ventas últimos 7 días`,
    `- Total: $${weekTotal.toLocaleString()} MXN`,
    `- Órdenes: ${weekCount}`,
    `- Promedio diario: $${Math.round(weekTotal / 7).toLocaleString()}`,
    '',
    `## Top 5 productos (última semana)`,
    ...top5.map((p, i) => `${i + 1}. ${p.name} — ${p.qty} vendidos ($${p.revenue.toLocaleString()})`),
  ];

  if (recentCustomers.length > 0) {
    lines.push('', '## Mejores clientes');
    for (const c of recentCustomers) {
      lines.push(`- ${c.firstName} ${c.lastName}: ${c.totalVisits} visitas, $${c.totalSpent.toLocaleString()} gastado`);
    }
  }

  return lines.join('\n');
}

// ─── System Prompt ───────────────────────────────────────────────────────────

function buildSystemPrompt(tenantName: string, businessType: string, context: string): string {
  const toneMap: Record<string, string> = {
    RESTAURANT: 'cercano y servicial, como un socio de confianza del restaurantero',
    BARBERSHOP: 'directo y amigable, como un colega barbero que sabe del negocio',
    CAFE: 'cálido y creativo, como un barista que entiende el negocio',
    STORE: 'práctico y eficiente, como un asesor de tienda',
    GENERAL: 'profesional y útil',
  };

  const tone = toneMap[businessType] || toneMap.GENERAL;

  return `Eres el asistente inteligente de "${tenantName}". Tu tono es ${tone}.

Tu trabajo es ayudar al dueño/administrador del negocio a:
- Entender sus ventas y métricas
- Identificar productos estrella y productos que no se venden
- Dar recomendaciones accionables basadas en datos reales
- Responder preguntas sobre su negocio de forma directa

REGLAS:
1. Responde en español, máximo 300 palabras.
2. Usa los datos reales que se te proporcionan abajo. NO inventes números.
3. Si no tienes la información para responder algo, dilo honestamente.
4. Da recomendaciones concretas cuando sea relevante.
5. Usa formato con negritas y listas para que sea fácil de leer.
6. NUNCA menciones "Logan", "tenant", "multi-tenant" ni nada técnico. Habla como si fueras parte del equipo del negocio.
7. Si el dueño pregunta algo que no puedes responder con los datos disponibles, sugiere qué datos necesitaría registrar.

${context}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const aiService = {
  ask: async ({ tenantId, message, history }: AskOptions): Promise<AskResult> => {
    // Build context from real tenant data
    const context = await buildTenantContext(tenantId);

    // Get tenant info for the system prompt
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, businessType: true },
    });

    if (!tenant) throw new Error('Tenant no encontrado');

    const systemPrompt = buildSystemPrompt(tenant.name, tenant.businessType, context);

    // Call LLM with context + history
    const result = await callLLM(systemPrompt, message, history);

    return { response: result.text, provider: result.provider };
  },
};
