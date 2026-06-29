document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const views = {
    onboarding: document.getElementById('viewOnboarding'),
    botPicker: document.getElementById('viewBotPicker'),
    chat: document.getElementById('viewChat')
  };
  
  const adminToggleContainer = document.getElementById('adminToggleContainer');
  const adminSwitch = document.getElementById('adminSwitch');
  const toggleLabel = document.getElementById('toggleLabel');
  const adminDashboard = document.getElementById('adminDashboard');
  
  const slidesWrapper = document.getElementById('slidesWrapper');
  const indicators = document.querySelectorAll('.indicator');
  const btnStartDemo = document.getElementById('btnStartDemo');
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
  let currentSlide = 0;
  let activeBot = null;
  let chatHistory = [];
  let isAdminMode = false;
  
  // ─── Routing / Views ───
  function showView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    
    // Show admin toggle only in chat view
    if (viewName === 'chat') {
      adminToggleContainer.style.display = 'flex';
    } else {
      adminToggleContainer.style.display = 'none';
      isAdminMode = false;
      adminSwitch.checked = false;
      toggleLabel.textContent = '👤 Cliente';
      adminDashboard.classList.add('hidden');
    }
  }

  // ─── Onboarding Logic ───
  function goToSlide(index) {
    currentSlide = index;
    slidesWrapper.style.transform = `translateX(-${index * 100}%)`;
    indicators.forEach((ind, i) => {
      ind.classList.toggle('active', i === index);
    });
  }

  indicators.forEach((ind, index) => {
    ind.addEventListener('click', () => goToSlide(index));
  });

  // Auto advance slides
  let slideInterval = setInterval(() => {
    goToSlide((currentSlide + 1) % indicators.length);
  }, 4000);

  btnStartDemo.addEventListener('click', () => {
    clearInterval(slideInterval);
    loadBots();
    showView('botPicker');
  });

  // ─── Bot Picker Logic ───
  async function loadBots() {
    try {
      const res = await fetch('/api/bots');
      const bots = await res.json();
      renderBots(bots);
    } catch (e) {
      botGrid.innerHTML = '<div class="loading-bots">Erro ao carregar bots. Tente recarregar a página.</div>';
    }
  }

  function renderBots(bots) {
    botGrid.innerHTML = '';
    for (const [id, bot] of Object.entries(bots)) {
      const card = document.createElement('div');
      card.className = 'bot-card';
      card.innerHTML = `
        <div class="bot-card-header">
          <div class="bot-card-icon" style="color: ${bot.accent}; box-shadow: inset 0 0 10px ${bot.accent}40;">${bot.icon}</div>
          <div class="bot-card-title">
            <h3>${bot.name}</h3>
            <span>${bot.business}</span>
          </div>
        </div>
        <div class="bot-tagline">${bot.tagline}</div>
        <div class="bot-caps">
          ${bot.capabilities.map(cap => `<span class="bot-cap-tag">${cap}</span>`).join('')}
        </div>
      `;
      card.addEventListener('click', () => startChat(id, bot));
      botGrid.appendChild(card);
    }
  }

  // ─── Admin Mode Logic ───
  adminSwitch.addEventListener('change', (e) => {
    isAdminMode = e.target.checked;
    toggleLabel.textContent = isAdminMode ? '⚙️ Gestor' : '👤 Cliente';
    
    if (isAdminMode) {
      adminDashboard.classList.remove('hidden');
      // Add a mock system message in chat
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
    
    // Initial Greeting Mock based on bot name (since system prompt is hidden)
    setTimeout(() => {
      addMessage(`Olá! Sou ${botMeta.name}, assistente virtual da ${botMeta.business}. Como posso ajudar?`, 'bot');
    }, 500);
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
          history: chatHistory.slice(-6) // send last 6 messages for context
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
      
      // Update limits
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
    // Simple markdown to HTML (just handling line breaks and bold for demo)
    let formattedText = text.replace(/\n/g, '<br>');
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    div.innerHTML = `<p>${formattedText}</p>`;
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
    // Para reiniciar, apagamos o cookie resetando a sessão (só disponível em dev, mas aqui forçamos reload)
    try {
      await fetch('/api/reset', { method: 'POST' });
    } catch(e) {}
    window.location.reload();
  });
  
});
