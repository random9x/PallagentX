/**
 * Pall AgentX — Frontend Logic v1.2
 * 
 * Features:
 *   - Chat messaging with conversation history
 *   - Session persistence via localStorage (Save/Load)
 *   - New Chat + Recent Chats sidebar
 *   - Web Speech API voice recognition
 *   - Auto-growing textarea
 *   - Ambient particle canvas animation
 *   - Elegant loading states
 *   - Markdown-lite rendering for AI responses
 */

(function () {
  'use strict';

  // ══════════════════════════════════════════════
  // CONSTANTS
  // ══════════════════════════════════════════════
  const STORAGE_KEY = 'pall_agentx_sessions';
  const ACTIVE_SESSION_KEY = 'pall_agentx_active_session';
  const MAX_SESSIONS = 50;

  // ══════════════════════════════════════════════
  // DOM REFERENCES
  // ══════════════════════════════════════════════
  const DOM = {
    chatMessages:     document.getElementById('chat-messages'),
    chatInput:        document.getElementById('chat-input'),
    btnSend:          document.getElementById('btn-send'),
    btnVoice:         document.getElementById('btn-voice'),
    btnClear:         document.getElementById('btn-clear'),
    btnNewChat:       document.getElementById('btn-new-chat'),
    btnHistory:       document.getElementById('btn-history'),
    btnCloseHistory:  document.getElementById('btn-close-history'),
    historySidebar:   document.getElementById('history-sidebar'),
    historyOverlay:   document.getElementById('history-overlay'),
    historyList:      document.getElementById('history-list'),
    loadingIndicator: document.getElementById('loading-indicator'),
    connectionStatus: document.getElementById('connection-status'),
    welcomeMessage:   document.getElementById('welcome-message'),
    ambientCanvas:    document.getElementById('ambient-canvas'),
  };

  // ══════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════
  const state = {
    currentSessionId: null,
    conversationHistory: [],
    isProcessing: false,
    isListening: false,
    recognition: null,
  };

  // ══════════════════════════════════════════════
  // INITIALIZATION
  // ══════════════════════════════════════════════
  function init() {
    setupEventListeners();
    setupVoiceRecognition();
    setupAutoResize();
    initAmbientCanvas();
    updateSendButton();
    loadActiveSession();
  }

  // ══════════════════════════════════════════════
  // EVENT LISTENERS
  // ══════════════════════════════════════════════
  function setupEventListeners() {
    // Send button
    DOM.btnSend.addEventListener('click', handleSend);

    // Enter to send (Shift+Enter for newline)
    DOM.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Voice button
    DOM.btnVoice.addEventListener('click', toggleVoice);

    // Clear button
    DOM.btnClear.addEventListener('click', clearConversation);

    // New Chat button
    DOM.btnNewChat.addEventListener('click', startNewChat);

    // History sidebar
    DOM.btnHistory.addEventListener('click', openHistory);
    DOM.btnCloseHistory.addEventListener('click', closeHistory);
    DOM.historyOverlay.addEventListener('click', closeHistory);

    // Update send button state on input
    DOM.chatInput.addEventListener('input', updateSendButton);
  }

  // ══════════════════════════════════════════════
  // AUTO-RESIZE TEXTAREA
  // ══════════════════════════════════════════════
  function setupAutoResize() {
    DOM.chatInput.addEventListener('input', () => {
      DOM.chatInput.style.height = 'auto';
      const maxHeight = 120;
      DOM.chatInput.style.height = Math.min(DOM.chatInput.scrollHeight, maxHeight) + 'px';
    });
  }

  // ══════════════════════════════════════════════
  // SEND BUTTON STATE
  // ══════════════════════════════════════════════
  function updateSendButton() {
    const hasText = DOM.chatInput.value.trim().length > 0;
    DOM.btnSend.classList.toggle('active', hasText);
  }

  // ══════════════════════════════════════════════
  // SESSION MANAGEMENT (localStorage)
  // ══════════════════════════════════════════════

  /**
   * Get all saved sessions from localStorage.
   * Returns an array of session objects sorted by updatedAt (newest first).
   */
  function getAllSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const sessions = JSON.parse(raw);
      return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  /**
   * Save all sessions to localStorage.
   */
  function saveSessions(sessions) {
    // Enforce max session limit
    const trimmed = sessions.slice(0, MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  }

  /**
   * Generate a unique session ID.
   */
  function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  }

  /**
   * Extract a title from conversation messages.
   * Uses the first user message, truncated.
   */
  function extractSessionTitle(messages) {
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (!firstUserMsg) return 'New Conversation';
    const text = firstUserMsg.content.trim();
    return text.length > 60 ? text.substring(0, 57) + '...' : text;
  }

  /**
   * Save the current session.
   */
  function saveCurrentSession() {
    if (state.conversationHistory.length === 0) return;

    const sessions = getAllSessions();
    const existingIndex = sessions.findIndex(s => s.id === state.currentSessionId);

    const sessionData = {
      id: state.currentSessionId,
      title: extractSessionTitle(state.conversationHistory),
      messages: state.conversationHistory,
      createdAt: existingIndex >= 0 ? sessions[existingIndex].createdAt : Date.now(),
      updatedAt: Date.now(),
      messageCount: state.conversationHistory.length,
    };

    if (existingIndex >= 0) {
      sessions[existingIndex] = sessionData;
    } else {
      sessions.unshift(sessionData);
    }

    saveSessions(sessions);
    localStorage.setItem(ACTIVE_SESSION_KEY, state.currentSessionId);
  }

  /**
   * Load a specific session by ID.
   */
  function loadSession(sessionId) {
    const sessions = getAllSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return false;

    state.currentSessionId = session.id;
    state.conversationHistory = [...session.messages];
    localStorage.setItem(ACTIVE_SESSION_KEY, session.id);

    // Rebuild chat UI
    rebuildChatUI();
    closeHistory();
    return true;
  }

  /**
   * Load the active session on startup.
   */
  function loadActiveSession() {
    const activeId = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (activeId) {
      const loaded = loadSession(activeId);
      if (loaded) return;
    }
    // Start fresh
    state.currentSessionId = generateSessionId();
  }

  /**
   * Delete a session by ID.
   */
  function deleteSession(sessionId) {
    let sessions = getAllSessions();
    sessions = sessions.filter(s => s.id !== sessionId);
    saveSessions(sessions);

    // If we deleted the active session, start new
    if (sessionId === state.currentSessionId) {
      startNewChat();
    }

    renderHistoryList();
  }

  // ══════════════════════════════════════════════
  // NEW CHAT
  // ══════════════════════════════════════════════
  function startNewChat() {
    // Save current session before starting new
    saveCurrentSession();

    // Reset state
    state.currentSessionId = generateSessionId();
    state.conversationHistory = [];
    localStorage.setItem(ACTIVE_SESSION_KEY, state.currentSessionId);

    // Reset UI
    DOM.chatMessages.innerHTML = '';
    showWelcomeMessage();
    closeHistory();
  }

  // ══════════════════════════════════════════════
  // HISTORY SIDEBAR
  // ══════════════════════════════════════════════
  function openHistory() {
    // Save current before showing history
    saveCurrentSession();
    renderHistoryList();
    DOM.historySidebar.classList.add('open');
    DOM.historyOverlay.classList.remove('hidden');
    DOM.historyOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeHistory() {
    DOM.historySidebar.classList.remove('open');
    DOM.historyOverlay.classList.add('hidden');
    DOM.historyOverlay.setAttribute('aria-hidden', 'true');
  }

  function renderHistoryList() {
    const sessions = getAllSessions();

    if (sessions.length === 0) {
      DOM.historyList.innerHTML = '<div class="history-empty">No saved conversations yet.</div>';
      return;
    }

    DOM.historyList.innerHTML = '';

    sessions.forEach((session) => {
      const item = document.createElement('div');
      item.className = 'history-item' + (session.id === state.currentSessionId ? ' active' : '');

      const titleEl = document.createElement('span');
      titleEl.className = 'history-item-title';
      titleEl.textContent = session.title;

      const metaEl = document.createElement('span');
      metaEl.className = 'history-item-meta';
      const date = new Date(session.updatedAt);
      const msgCount = session.messageCount || session.messages.length;
      metaEl.textContent = formatDate(date) + ' -- ' + msgCount + ' messages';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'history-item-delete';
      deleteBtn.title = 'Delete conversation';
      deleteBtn.setAttribute('aria-label', 'Delete conversation');
      deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSession(session.id);
      });

      item.appendChild(titleEl);
      item.appendChild(metaEl);
      item.appendChild(deleteBtn);

      item.addEventListener('click', () => {
        loadSession(session.id);
      });

      DOM.historyList.appendChild(item);
    });
  }

  function formatDate(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + 'm ago';
    if (diffHours < 24) return diffHours + 'h ago';
    if (diffDays < 7) return diffDays + 'd ago';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // ══════════════════════════════════════════════
  // MESSAGE HANDLING
  // ══════════════════════════════════════════════
  async function handleSend() {
    const message = DOM.chatInput.value.trim();
    if (!message || state.isProcessing) return;

    // Hide welcome message
    const welcomeEl = document.getElementById('welcome-message');
    if (welcomeEl) {
      welcomeEl.style.opacity = '0';
      welcomeEl.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        welcomeEl.remove();
      }, 400);
    }

    // Add user message to UI
    appendMessage('user', message);

    // Clear input
    DOM.chatInput.value = '';
    DOM.chatInput.style.height = 'auto';
    updateSendButton();

    // Add to conversation history
    state.conversationHistory.push({
      role: 'user',
      content: message,
    });

    // Auto-save after user message
    saveCurrentSession();

    // Show loading
    setProcessing(true);

    try {
      const response = await sendToBackend(state.conversationHistory);

      // Add assistant response
      state.conversationHistory.push({
        role: 'assistant',
        content: response,
      });

      appendMessage('assistant', response);

      // Auto-save after assistant response
      saveCurrentSession();
    } catch (error) {
      console.error('Chat Error:', error);
      appendMessage('assistant', 'Connection interrupted. Please verify your network and try again.');
    } finally {
      setProcessing(false);
    }
  }

  // ══════════════════════════════════════════════
  // BACKEND COMMUNICATION
  // ══════════════════════════════════════════════
  async function sendToBackend(messages) {
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.reply;
  }

  // ══════════════════════════════════════════════
  // DOM — APPEND MESSAGE
  // ══════════════════════════════════════════════
  function appendMessage(role, content) {
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${role}`;

    const labelEl = document.createElement('span');
    labelEl.className = 'message-label';
    labelEl.textContent = role === 'user' ? 'You' : 'AgentX';

    const contentEl = document.createElement('div');
    contentEl.className = 'message-content';

    // Render content (with basic markdown support for assistant)
    if (role === 'assistant') {
      contentEl.innerHTML = renderMarkdown(content);
    } else {
      contentEl.textContent = content;
    }

    // Build structure
    const wrapper = document.createElement('div');
    wrapper.appendChild(labelEl);
    wrapper.appendChild(contentEl);
    messageEl.appendChild(wrapper);

    DOM.chatMessages.appendChild(messageEl);
    scrollToBottom();
  }

  // ══════════════════════════════════════════════
  // REBUILD CHAT UI (for loading sessions)
  // ══════════════════════════════════════════════
  function rebuildChatUI() {
    DOM.chatMessages.innerHTML = '';

    if (state.conversationHistory.length === 0) {
      showWelcomeMessage();
      return;
    }

    state.conversationHistory.forEach((msg) => {
      appendMessage(msg.role, msg.content);
    });

    scrollToBottom();
  }

  // ══════════════════════════════════════════════
  // WELCOME MESSAGE
  // ══════════════════════════════════════════════
  function showWelcomeMessage() {
    const welcomeHTML = `
      <div class="message message-system fade-in" id="welcome-message">
        <div class="message-content">
          <div class="welcome-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#msg-gold)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
              <defs>
                <linearGradient id="msg-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#c9a84c" />
                  <stop offset="100%" style="stop-color:#f0d98c" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <p class="welcome-title">Welcome to Pall AgentX</p>
          <p class="welcome-text">Your autonomous AI assistant is ready. Type a message or use voice input to begin.</p>
        </div>
      </div>
    `;
    DOM.chatMessages.innerHTML = welcomeHTML;
  }

  // ══════════════════════════════════════════════
  // MARKDOWN-LITE RENDERER
  // ══════════════════════════════════════════════
  function renderMarkdown(text) {
    if (!text) return '';

    let html = escapeHtml(text);

    // Code blocks (triple backtick)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="lang-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Line breaks
    html = html.replace(/\n/g, '<br/>');

    return html;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ══════════════════════════════════════════════
  // SCROLL
  // ══════════════════════════════════════════════
  function scrollToBottom() {
    requestAnimationFrame(() => {
      DOM.chatMessages.scrollTo({
        top: DOM.chatMessages.scrollHeight,
        behavior: 'smooth',
      });
    });
  }

  // ══════════════════════════════════════════════
  // PROCESSING STATE
  // ══════════════════════════════════════════════
  function setProcessing(isProcessing) {
    state.isProcessing = isProcessing;
    DOM.loadingIndicator.classList.toggle('hidden', !isProcessing);
    DOM.chatInput.disabled = isProcessing;
    DOM.btnSend.disabled = isProcessing;
    DOM.connectionStatus.textContent = isProcessing ? 'Processing' : 'Connected';

    if (isProcessing) {
      scrollToBottom();
    }
  }

  // ══════════════════════════════════════════════
  // CLEAR CONVERSATION
  // ══════════════════════════════════════════════
  function clearConversation() {
    state.conversationHistory = [];
    DOM.chatMessages.innerHTML = '';
    showWelcomeMessage();

    // Update saved session to empty
    saveCurrentSession();
  }

  // ══════════════════════════════════════════════
  // VOICE RECOGNITION (Web Speech API)
  // ══════════════════════════════════════════════
  function setupVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Hide mic button if not supported
      DOM.btnVoice.style.display = 'none';
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'id-ID'; // Default: Indonesian
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      state.isListening = true;
      DOM.btnVoice.classList.add('listening');
      DOM.chatInput.placeholder = 'Listening...';
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      DOM.chatInput.value = transcript;
      DOM.chatInput.style.height = 'auto';
      DOM.chatInput.style.height = Math.min(DOM.chatInput.scrollHeight, 120) + 'px';
      updateSendButton();
    };

    recognition.onend = () => {
      state.isListening = false;
      DOM.btnVoice.classList.remove('listening');
      DOM.chatInput.placeholder = 'Enter your message...';

      // Auto-detect language for next session
      const currentText = DOM.chatInput.value;
      if (currentText && /[a-zA-Z]/.test(currentText) && !/[a-zA-Z]*[aiueo]/.test(currentText.toLowerCase())) {
        recognition.lang = 'en-US';
      } else {
        recognition.lang = 'id-ID';
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech Recognition Error:', event.error);
      state.isListening = false;
      DOM.btnVoice.classList.remove('listening');
      DOM.chatInput.placeholder = 'Enter your message...';
    };

    state.recognition = recognition;
  }

  function toggleVoice() {
    if (!state.recognition) return;

    if (state.isListening) {
      state.recognition.stop();
    } else {
      state.recognition.start();
    }
  }

  // ══════════════════════════════════════════════
  // AMBIENT PARTICLE CANVAS
  // ══════════════════════════════════════════════
  function initAmbientCanvas() {
    const canvas = DOM.ambientCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;

    function resize() {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }

    function createParticles() {
      particles = [];
      const count = Math.floor((canvas.width * canvas.height) / 15000);
      for (let i = 0; i < Math.min(count, 60); i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 1.2 + 0.3,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.15,
          opacity: Math.random() * 0.4 + 0.1,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const time = Date.now() * 0.001;

      particles.forEach((p) => {
        // Gentle floating motion
        p.x += p.vx;
        p.y += p.vy + Math.sin(time + p.phase) * 0.05;

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Pulsing opacity
        const currentOpacity = p.opacity + Math.sin(time * 0.8 + p.phase) * 0.15;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201, 168, 76, ${Math.max(0, currentOpacity)})`;
        ctx.fill();
      });

      // Draw connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            const lineOpacity = (1 - dist / 120) * 0.08;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(201, 168, 76, ${lineOpacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(draw);
    }

    // Media query: only run on desktop
    const mql = window.matchMedia('(min-width: 769px)');
    
    function handleMediaChange(e) {
      if (e.matches) {
        resize();
        createParticles();
        if (!animationId) draw();
      } else {
        if (animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
      }
    }

    mql.addEventListener('change', handleMediaChange);
    window.addEventListener('resize', () => {
      if (mql.matches) {
        resize();
        createParticles();
      }
    });

    // Initial
    if (mql.matches) {
      resize();
      createParticles();
      draw();
    }
  }

  // ══════════════════════════════════════════════
  // BOOT
  // ══════════════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
