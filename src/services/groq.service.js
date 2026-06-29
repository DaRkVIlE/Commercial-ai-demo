const API_KEYS = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
].filter(Boolean);

if (API_KEYS.length === 0) {
  console.error('[FATAL] No GROQ_API_KEY_* environment variables set.');
}

/**
 * Envia uma requisição de chat para a API da Groq
 */
export async function generateChatCompletion(bot, messages) {
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
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        lastError = new Error('Empty response from API');
        continue;
      }

      return {
        content,
        keyIndex: i + 1
      };
    } catch (error) {
      console.error(`[PROXY] Key ${i + 1} fetch error:`, error.message);
      lastError = error;
    }
  }

  throw new Error(lastError?.message || 'All API keys exhausted');
}
