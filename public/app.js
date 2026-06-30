document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const views = {
    botPicker: document.getElementById('viewBotPicker'),
    chat: document.getElementById('viewChat')
  };
  
  const adminBar = document.getElementById('adminBar');
  const adminSwitch = document.getElementById('adminSwitch');
  const toggleLabel = document.getElementById('toggleLabel');
  const adminDashboard = document.getElementById('adminDashboard');
  
  const botGrid = document.getElementById('botGrid');
  const btnBackToPicker = document.getElementById('btnBackToPicker');
  const chatHeaderIcon = document.getElementById('chatHeaderIcon');
  const chatHeaderName = document.getElementById('chatHeaderName');
  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const btnSend = document.getElementById('btnSend');
  const messageCounter = document.getElementById('messageCounter');
  
  const conversionWall = document.getElementById('conversionWall');
  const btnRestartDemo = document.getElementById('btnRestartDemo');

  // State
  let activeBot = null;
  let chatHistory = [];
  let isAdminMode = false;
  
  // Initialize
  loadBots();
  
  // ─── Routing / Views ───
  function showView(viewName) {
    Object.values(views).forEach(v => {
      v.classList.add('hidden');
      v.classList.remove('active-view');
    });
    views[viewName].classList.remove('hidden');
    views[viewName].classList.add('active-view');
    
    // Show admin toggle only in chat view
    if (viewName === 'chat') {
      adminBar.style.display = 'flex';
    } else {
      adminBar.style.display = 'none';
      isAdminMode = false;
      adminSwitch.checked = false;
      toggleLabel.textContent = '👤 Atendente';
      adminDashboard.classList.add('hidden');
    }
  }

  // ─── Bot Picker Logic ───
  async function loadBots() {
    try {
      const res = await fetch('/api/bots');
      const bots = await res.json();
      renderBots(bots);
    } catch (e) {
      botGrid.innerHTML = '<div class="loading-bots">Erro ao carregar agentes. Tente novamente.</div>';
    }
  }

  function sanitize(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
  }

  function renderBots(bots) {
    botGrid.innerHTML = '';
    for (const [id, bot] of Object.entries(bots)) {
      const card = document.createElement('div');
      card.className = 'bot-card';
      const safeIcon = sanitize(bot.icon);
      const safeName = sanitize(bot.name);
      const safeBusiness = sanitize(bot.business);
      const safeAccent = sanitize(bot.accent);
      const safeCaps = (bot.capabilities || []).map(c => `<span class="bot-cap-tag">${sanitize(c)}</span>`).join('');
      card.innerHTML = `
        <div class="bot-card-header">
          <div class="bot-card-icon" style="color: ${safeAccent}; box-shadow: inset 0 0 10px ${safeAccent}40;">${safeIcon}</div>
          <div class="bot-card-title">
            <h3>${safeName}</h3>
            <span>${safeBusiness}</span>
          </div>
        </div>
        <div class="bot-caps">${safeCaps}</div>
      `;
      card.addEventListener('click', () => startChat(id, bot));
      botGrid.appendChild(card);
    }
  }

  // ─── Admin Mode Logic ───
  adminSwitch.addEventListener('change', (e) => {
    isAdminMode = e.target.checked;
    toggleLabel.textContent = isAdminMode ? '🤖 Assistente' : '👤 Atendente';
    
    if (isAdminMode) {
      adminDashboard.classList.remove('hidden');
      addMessage('Sistema (Gestor): Você está vendo a perspectiva do dono do negócio. As mensagens do cliente chegam aqui estruturadas.', 'bot');
    } else {
      adminDashboard.classList.add('hidden');
    }
  });

  // ─── Chat Logic ───
  async function startChat(botId, botMeta) {
    activeBot = { id: botId, ...botMeta };
    chatHeaderName.textContent = botMeta.name;
    chatHeaderIcon.textContent = botMeta.icon;
    chatMessages.innerHTML = '';
    chatHistory = [];
    
    // Check session limits before opening
    await updateSessionStatus();
    showView('chat');
    
    const typingId = showTypingIndicator();
    try {
      const res = await fetch('/api/greet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId }),
      });
      const data = await res.json();
      removeTypingIndicator(typingId);
      addMessage(data.greeting || `Olá! Sou ${botMeta.name}. Como posso ajudar?`, 'bot');
    } catch {
      removeTypingIndicator(typingId);
      addMessage(`Olá! Sou ${botMeta.name}, assistente virtual da ${botMeta.business}. Como posso ajudar?`, 'bot');
    }
  }

  btnBackToPicker.addEventListener('click', () => {
    showView('botPicker');
  });

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    // UI Updates
    chatInput.value = '';
    btnSend.disabled = true;
    addMessage(text, 'user');
    chatHistory.push({ role: 'user', content: text });
    
    const typingId = showTypingIndicator();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: activeBot.id,
          message: text,
          history: chatHistory.slice(-6)
        })
      });

      removeTypingIndicator(typingId);
      const data = await response.json();

      if (!response.ok || data.error) {
        if (data.error === 'limit_reached') {
          showConversionWall();
        } else {
          addMessage(data.error || 'Ocorreu um erro. Tente novamente.', 'bot');
        }
        return;
      }

      addMessage(data.reply, 'bot');
      chatHistory.push({ role: 'assistant', content: data.reply });
      
      messageCounter.textContent = `Mensagem ${data.messagesUsed} de ${data.messagesLimit}`;
      if (data.limitReached) {
        setTimeout(showConversionWall, 1500);
      }

    } catch (err) {
      removeTypingIndicator(typingId);
      addMessage('Erro de conexão. Verifique sua internet.', 'bot');
    } finally {
      btnSend.disabled = false;
      chatInput.focus();
    }
  });

  // ─── Helpers ───
  function addMessage(text, sender) {
    const div = document.createElement('div');
    div.className = `message msg-${sender}`;
    let formattedText = text.replace(/\n/g, '<br>');
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    div.innerHTML = formattedText;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'typing-indicator';
    div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return id;
  }

  function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  async function updateSessionStatus() {
    try {
      const res = await fetch('/api/session');
      const data = await res.json();
      messageCounter.textContent = `Mensagem ${data.messagesUsed} de ${data.messagesLimit}`;
      if (data.limitReached) showConversionWall();
    } catch(e) {}
  }

  function showConversionWall() {
    conversionWall.classList.remove('hidden');
  }

  btnRestartDemo.addEventListener('click', async () => {
    try {
      await fetch('/api/reset', { method: 'POST' });
    } catch(e) {}
    conversionWall.classList.add('hidden');
    messageCounter.textContent = `Mensagem 0 de 10`;
    showView('botPicker');
  });
});
