import { botsConfig } from '../config/bots.registry.js';
import { generateChatCompletion } from '../services/groq.service.js';
import { getOrCreateSession, sessions } from '../middlewares/security.middleware.js';

const MAX_MESSAGES = parseInt(process.env.MAX_MESSAGES_PER_SESSION || '10', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

export const listBots = (req, res) => {
  const publicBots = {};
  for (const [id, bot] of Object.entries(botsConfig)) {
    publicBots[id] = {
      name: bot.name,
      business: bot.business,
      icon: bot.icon,
      accent: bot.accent,
      tagline: bot.tagline,
      capabilities: bot.capabilities,
    };
  }
  res.json(publicBots);
};

export const getSessionStatus = (req, res) => {
  const session = getOrCreateSession(req.sessionId);
  res.json({
    messagesUsed: session.messageCount,
    messagesLimit: MAX_MESSAGES,
    limitReached: session.messageCount >= MAX_MESSAGES,
  });
};

export const handleChat = async (req, res) => {
  const { botId, message, history } = req.body;

  if (!botId || typeof botId !== 'string') return res.status(400).json({ error: 'botId é obrigatório.' });
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message é obrigatória.' });
  if (message.length > 1000) return res.status(400).json({ error: 'Mensagem muito longa. Máximo de 1000 caracteres.' });

  const bot = botsConfig[botId];
  if (!bot) return res.status(404).json({ error: 'Bot não encontrado.' });

  const session = getOrCreateSession(req.sessionId);
  if (session.messageCount >= MAX_MESSAGES) {
    return res.status(403).json({
      error: 'limit_reached',
      messagesUsed: session.messageCount,
      messagesLimit: MAX_MESSAGES,
      upgradeUrl: 'https://chat.experiasolutions.com.br',
    });
  }

  const messages = [{ role: 'system', content: bot.systemPrompt }];

  if (Array.isArray(history)) {
    const safeHistory = history.slice(-8).map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: String(msg.content).slice(0, 1000),
    }));
    messages.push(...safeHistory);
  }

  messages.push({ role: 'user', content: message });

  try {
    const { content, keyIndex } = await generateChatCompletion(bot, messages);
    session.messageCount++;

    return res.json({
      reply: content,
      messagesUsed: session.messageCount,
      messagesLimit: MAX_MESSAGES,
      limitReached: session.messageCount >= MAX_MESSAGES,
      ...(NODE_ENV !== 'production' && { keyUsed: keyIndex }),
    });
  } catch (error) {
    console.error('[CHAT ERROR]:', error.message);
    res.status(502).json({
      error: 'Todos os serviços de IA estão temporariamente indisponíveis. Tente novamente em alguns instantes.',
    });
  }
};

export const handleGreet = async (req, res) => {
  const { botId } = req.body;
  if (!botId || typeof botId !== 'string') return res.status(400).json({ error: 'botId é obrigatório.' });
  
  const bot = botsConfig[botId];
  if (!bot) return res.status(404).json({ error: 'Bot não encontrado.' });

  const greetMessages = [
    { role: 'system', content: bot.systemPrompt },
    { role: 'user', content: '[SISTEMA INTERNO] Envie sua mensagem de boas-vindas inicial ao cliente, seguindo exatamente sua persona. Seja caloroso e convide-o a interagir. Máximo 2 frases.' },
  ];

  try {
    const { content } = await generateChatCompletion(bot, greetMessages);
    return res.json({ greeting: content });
  } catch (error) {
    return res.json({ greeting: `Olá! Sou ${bot.name}, assistente virtual da ${bot.business}. Como posso ajudar você hoje?` });
  }
};

export const resetSession = (req, res) => {
  const session = sessions.get(req.sessionId);
  if (session) {
    session.messageCount = 0;
    session.lastAccess = Date.now();
  } else {
    sessions.delete(req.sessionId);
  }
  res.json({ ok: true, message: 'Session reset.' });
};
