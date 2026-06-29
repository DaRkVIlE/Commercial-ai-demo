# Experia Bots — Demo Pública

> Plataforma de demonstração dos assistentes comerciais de IA da Experia Solutions. Permite que visitantes testem diferentes personas de bots sem criar conta.

## 🚀 Stack

- **Backend:** Node.js + Express (ESM)
- **Frontend:** HTML + CSS + Vanilla JS (SPA)
- **LLM:** Groq API (`llama-3.3-70b-versatile`) com fallback de 3 chaves
- **Deploy:** Railway (Docker)

## 🛡️ Segurança

- Rate limiting (global 30/min + chat 12/min)
- Sessões por cookie assinado (HTTPOnly, Secure, SameSite=strict)
- System prompts protegidos no servidor — nunca expostos ao cliente
- Helmet (CSP, HSTS, X-Frame-Options)
- Sanitização de inputs no frontend (anti-XSS)
- Limite de 10 mensagens por sessão (server-side)
- Fallback automático entre 3 API keys Groq

## 🤖 Bots Disponíveis

| Bot | Segmento |
|---|---|
| Sofia | Bistrô / Restaurante |
| Felícia | Assistência Técnica (Celulares) |
| Paulo | Tapeçaria / Estofados |
| Porto | Bar / Cervejaria |
| Letícia | Clínica de Estética |

## ⚙️ Configuração

```bash
# 1. Clone e instale
npm install

# 2. Configure as variáveis
cp .env.example .env
# Edite .env com suas chaves Groq

# 3. Rode localmente
npm run dev
```

### Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `GROQ_API_KEY_1` | Chave primária Groq |
| `GROQ_API_KEY_2` | Chave fallback #2 |
| `GROQ_API_KEY_3` | Chave fallback #3 |
| `SESSION_SECRET` | Secret para assinar cookies |
| `MAX_MESSAGES_PER_SESSION` | Limite de msgs (padrão: 10) |
| `NODE_ENV` | `development` ou `production` |

## 🏗️ Estrutura

```
├── server.js          # Express proxy + API Groq
├── config/
│   └── bots.json      # Configuração e system prompts dos bots
├── public/
│   ├── index.html     # SPA principal
│   ├── styles.css     # Design system dark mode
│   └── app.js         # Lógica frontend
├── Dockerfile
└── railway.toml
```

## 🔄 Fluxo do Usuário

```
Onboarding (3 slides) → Seleção de Bot → Chat (10 msgs) → CTA: Criar Conta
                                              ↑
                                    Saudação real via LLM
```

## 📦 Deploy no Railway

```bash
railway link    # Vincular ao projeto
railway up      # Deploy
```

Após o deploy, configurar as variáveis de ambiente no painel Railway.
