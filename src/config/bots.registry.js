import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const clientsPath = join(__dirname, '..', 'data', 'clients', 'bots.json');
const promptsPath = join(__dirname, '..', 'data', 'prompts');

// Carrega metadados dos bots (nome, ícone, accent, etc.)
const botsMetadata = JSON.parse(readFileSync(clientsPath, 'utf-8'));

// Mapa: bot ID → arquivo de system prompt (.txt)
const PROMPT_FILES = {
  paulo:   '01_otto_atelier_dhecor.txt',
  porto:   '02_bier_porto_alemao.txt',
  sofia:   '03_sofia_bistro56.txt',    // v2 está na raiz — ver nota abaixo
  felicia: '04_felicia_felix_cell.txt',
};

// Carrega system prompts dos arquivos .txt (fonte de verdade)
function loadSystemPrompt(botId) {
  const filename = PROMPT_FILES[botId];
  if (!filename) {
    console.warn(`[REGISTRY] Nenhum arquivo .txt mapeado para botId="${botId}". Usando fallback inline.`);
    return botsMetadata[botId]?.systemPrompt || '';
  }
  try {
    return readFileSync(join(promptsPath, filename), 'utf-8');
  } catch (e) {
    console.error(`[REGISTRY] Falha ao carregar prompt "${filename}":`, e.message);
    return botsMetadata[botId]?.systemPrompt || '';
  }
}

// Monta o registry final: metadados + systemPrompt dos arquivos .txt
export const botsConfig = Object.fromEntries(
  Object.entries(botsMetadata).map(([id, meta]) => [
    id,
    {
      ...meta,
      systemPrompt: loadSystemPrompt(id), // sobrescreve o inline com o .txt completo
    },
  ])
);

// Log de validação na inicialização
for (const [id, bot] of Object.entries(botsConfig)) {
  const chars = bot.systemPrompt?.length || 0;
  console.log(`[REGISTRY] ✅ ${id} (${bot.name}) — prompt: ${chars} chars`);
}
