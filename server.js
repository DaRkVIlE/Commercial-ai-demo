import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Configuration ───────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
const MAX_MESSAGES = parseInt(process.env.MAX_MESSAGES_PER_SESSION || '10', 10);
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const NODE_ENV = process.env.NODE_ENV || 'development';

// Groq API keys — fallback chain
const API_KEYS = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
].filter(Boolean);

if (API_KEYS.length === 0) {
  console.error('[FATAL] No GROQ_API_KEY_* environment variables set. Exiting.');
  process.exit(1);
}

// Load bot configurations
const botsConfig = JSON.parse(readFileSync(join(__dirname, 'config', 'bots.json'), 'utf-8'));

// ─── Session Tracking (in-memory, resets on restart — fine for demo) ──
const sessions = new Map();
const SESSION_TTL = 1000 * 60 * 60 * 2; // 2 hours

function getOrCreateSession(sessionId) {
  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    session.lastAccess = Date.now();
    return session;
  }
  const session = { messageCount: 0, lastAccess: Date.now(), botHistory: {} };
  sessions.set(sessionId, session);
  return session;
}

// Cleanup stale sessions every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastAccess > SESSION_TTL) {
      sessions.delete(id);
    }
  }
}, 1000 * 60 * 30);

// ─── Express App ─────────────────────────────────────────────────
const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "https://img.icons8.com", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN === '*' ? true : process.env.ALLOWED_ORIGIN,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser(SESSION_SECRET));

// Rate limiting — global
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde um momento e tente novamente.' },
});
app.use('/api/', globalLimiter);

// Chat-specific rate limiting (stricter)
const chatLimiter = rateLimit({
  windowMs: 60000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de mensagens por minuto atingido. Respire fundo e tente novamente 😊' },
});

// ─── Session Cookie Middleware ────────────────────────────────────
app.use((req, res, next) => {
  let sessionId = req.signedCookies?.demo_session;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    res.cookie('demo_session', sessionId, {
      signed: true,
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_TTL,
    });
  }
  req.sessionId = sessionId;
  next();
});

// ─── Static Files ────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'public'), {
  maxAge: NODE_ENV === 'production' ? '1h' : 0,
}));

// ─── API: Health Check ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    bots: Object.keys(botsConfig).length,
    sessions: sessions.size,
  });
});

// ─── API: List Bots (public metadata only — no system prompts) ──
app.get('/api/bots', (req, res) => {
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
});

// ─── API: Session Status ─────────────────────────────────────────
app.get('/api/session', (req, res) => {
  const session = getOrCreateSession(req.sessionId);
  res.json({
    messagesUsed: session.messageCount,
    messagesLimit: MAX_MESSAGES,
    limitReached: session.messageCount >= MAX_MESSAGES,
  });
});

// ─── API: Chat (core proxy with security) ────────────────────────
app.post('/api/chat', chatLimiter, async (req, res) => {
  const { botId, message, history } = req.body;

  // Validate input
  if (!botId || typeof botId !== 'string') {
    return res.status(400).json({ error: 'botId é obrigatório.' });
  }
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message é obrigatória.' });
  }
  if (message.length > 1000) {
    return res.status(400).json({ error: 'Mensagem muito longa. Máximo de 1000 caracteres.' });
  }

  const bot = botsConfig[botId];
  if (!bot) {
    return res.status(404).json({ error: 'Bot não encontrado.' });
  }

  // Check message limit
  const session = getOrCreateSession(req.sessionId);
  if (session.messageCount >= MAX_MESSAGES) {
    return res.status(403).json({
      error: 'limit_reached',
      messagesUsed: session.messageCount,
      messagesLimit: MAX_MESSAGES,
      upgradeUrl: 'https://chat.experiasolutions.com.br',
    });
  }

  // Build conversation messages
  const messages = [
    { role: 'system', content: bot.systemPrompt },
  ];

  // Inject up to 8 previous messages from client history (sanitized)
  if (Array.isArray(history)) {
    const safeHistory = history.slice(-8).map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: String(msg.content).slice(0, 1000),
    }));
    messages.push(...safeHistory);
  }

  messages.push({ role: 'user', content: message });

  // Try each API key with fallback
  let lastError = null;
  for (let i = 0; i < API_KEYS.length; i++) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEYS[i]}`,
        },
        body: JSON.stringify({
          model: bot.model || 'llama-3.3-70b-versatile',
          messages,
          max_tokens: bot.maxTokens || 800,
          temperature: bot.temperature || 0.65,
          stream: false,
        }),
      });

      if (response.status === 429) {
        console.warn(`[PROXY] Key ${i + 1} rate limited, trying next...`);
        lastError = new Error(`Key ${i + 1} rate limited`);
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[PROXY] Key ${i + 1} error ${response.status}:`, errorBody);
        lastError = new Error(`API error ${response.status}`);
        continue;
      }

      const data = await response.json();
      const assistantMessage = data.choices?.[0]?.message?.content;

      if (!assistantMessage) {
        lastError = new Error('Empty response from API');
        continue;
      }

      // Success — increment counter
      session.messageCount++;

      return res.json({
        reply: assistantMessage,
        messagesUsed: session.messageCount,
        messagesLimit: MAX_MESSAGES,
        limitReached: session.messageCount >= MAX_MESSAGES,
        keyUsed: i + 1, // debug info (remove in prod if desired)
      });
    } catch (fetchError) {
      console.error(`[PROXY] Key ${i + 1} fetch error:`, fetchError.message);
      lastError = fetchError;
      continue;
    }
  }

  // All keys failed
  console.error('[PROXY] All API keys exhausted:', lastError?.message);
  res.status(502).json({
    error: 'Todos os serviços de IA estão temporariamente indisponíveis. Tente novamente em alguns instantes.',
  });
});

// ─── API: Reset Session (for testing only) ───────────────────────
if (NODE_ENV !== 'production') {
  app.post('/api/reset', (req, res) => {
    sessions.delete(req.sessionId);
    res.json({ ok: true, message: 'Session reset.' });
  });
}

// ─── Fallback: SPA ───────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[DEMO] Experia Bot Demo running on port ${PORT}`);
  console.log(`[DEMO] ${API_KEYS.length} API key(s) loaded for fallback`);
  console.log(`[DEMO] ${Object.keys(botsConfig).length} bot(s) configured`);
  console.log(`[DEMO] Message limit: ${MAX_MESSAGES} per session`);
});
