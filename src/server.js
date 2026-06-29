import 'dotenv/config';
import app from './app.js';
import { botsConfig } from './config/bots.registry.js';

const PORT = process.env.PORT || 8080;
const MAX_MESSAGES = parseInt(process.env.MAX_MESSAGES_PER_SESSION || '10', 10);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[DEMO] Experia Bot Demo running on port ${PORT}`);
  console.log(`[DEMO] ${Object.keys(botsConfig).length} bot(s) configured`);
  console.log(`[DEMO] Message limit: ${MAX_MESSAGES} per session`);
});
