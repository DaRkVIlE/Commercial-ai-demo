import { Router } from 'express';
import { chatLimiter, sessions } from '../middlewares/security.middleware.js';
import { botsConfig } from '../config/bots.registry.js';
import { 
  listBots, 
  getSessionStatus, 
  handleChat, 
  handleGreet, 
  resetSession 
} from '../controllers/chat.controller.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    bots: Object.keys(botsConfig).length,
    sessions: sessions.size,
  });
});

router.get('/bots', listBots);
router.get('/session', getSessionStatus);

router.post('/chat', chatLimiter, handleChat);
router.post('/greet', handleGreet);
router.post('/reset', resetSession);

export default router;
