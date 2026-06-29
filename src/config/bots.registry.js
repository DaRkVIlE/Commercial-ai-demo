import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carrega as configurações dos bots do json original (agora em src/data/clients/)
const botsConfigPath = join(__dirname, '..', 'data', 'clients', 'bots.json');
export const botsConfig = JSON.parse(readFileSync(botsConfigPath, 'utf-8'));
