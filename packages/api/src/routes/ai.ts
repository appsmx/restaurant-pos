import { Router, Response, NextFunction } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { aiService } from '../services/aiService';

/**
 * AI Assistant Routes
 *
 * POST /api/ai/ask — Ask the tenant's AI assistant a question
 *
 * Protected by auth. The tenant is resolved from the authenticated user's
 * tenantId (set by the auth middleware).
 */

const router = Router();
router.use(auth);

/**
 * POST /api/ai/ask
 *
 * Body: {
 *   message: string — the user's question
 *   history?: { role: string, content: string }[] — previous conversation
 * }
 *
 * Response: {
 *   response: string — the AI's answer
 *   provider: string — which LLM answered (gemini/openai/zai)
 * }
 */
router.post('/ask', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { message, history, confirmAction } = req.body;

    // confirmAction path: user is confirming a pending write action
    const isConfirming = confirmAction && typeof confirmAction.type === 'string';

    if (!isConfirming && (!message || typeof message !== 'string' || !message.trim())) {
      return res.status(400).json({ error: 'Mensaje vacío', hint: 'Envía un campo "message" con tu pregunta.' });
    }

    if (message && message.length > 2000) {
      return res.status(400).json({ error: 'Mensaje demasiado largo (máx 2000 caracteres)' });
    }

    const tenantId = (req as any).tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'No se pudo determinar el negocio.' });
    }

    const result = await aiService.ask({
      tenantId,
      message: (message || '').trim(),
      history: Array.isArray(history) ? history.slice(-10) : [], // Max 10 turns of history
      confirmAction: isConfirming ? confirmAction : undefined,
    });

    res.json(result);
  } catch (error: any) {
    if (error.message?.includes('proveedor de IA')) {
      return res.status(503).json({ error: error.message });
    }
    next(error);
  }
});

export default router;
