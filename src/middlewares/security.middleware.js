import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

const SESSION_TTL = 1000 * 60 * 60 * 2; // 2 hours
export const sessions = new Map();

// Cleanup stale sessions every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastAccess > SESSION_TTL) {
      sessions.delete(id);
    }
  }
}, 1000 * 60 * 30);

export function getOrCreateSession(sessionId) {
  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    session.lastAccess = Date.now();
    return session;
  }
  const session = { messageCount: 0, lastAccess: Date.now(), botHistory: {} };
  sessions.set(sessionId, session);
  return session;
}

export const securityHeaders = helmet({
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
});

export const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde um momento e tente novamente.' },
});

export const chatLimiter = rateLimit({
  windowMs: 60000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de mensagens por minuto atingido. Respire fundo e tente novamente 😊' },
});

export const sessionMiddleware = (req, res, next) => {
  let sessionId = req.signedCookies?.demo_session;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    res.cookie('demo_session', sessionId, {
      signed: true,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_TTL,
    });
  }
  req.sessionId = sessionId;
  next();
};
