import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { securityHeaders, sessionMiddleware, globalLimiter } from './middlewares/security.middleware.js';
import apiRoutes from './routes/api.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── Middleware Globais ──────────────────────────────────────────
app.use(securityHeaders);
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN === '*' ? true : process.env.ALLOWED_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser(process.env.SESSION_SECRET || 'default_secret'));

// ─── Session Handling ────────────────────────────────────────────
app.use(sessionMiddleware);

// ─── Static Files ────────────────────────────────────────────────
app.use(express.static(join(__dirname, '..', 'public'), {
  maxAge: NODE_ENV === 'production' ? '1h' : 0,
}));

// ─── Rotas ───────────────────────────────────────────────────────
app.use('/api', globalLimiter, apiRoutes);

// Fallback: SPA
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'public', 'index.html'));
});

export default app;
