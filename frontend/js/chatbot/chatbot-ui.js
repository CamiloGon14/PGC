/**
 * chatbot-ui.js — Construcción del DOM, accesibilidad ARIA y renderizado de mensajes
 * Hospital de Ubaté - Sistema de Gestión Hospitalaria
 */
(function () {
  window.eseb = window.eseb || {};
  const utils = window.eseb && window.eseb.utils;

  let launcherEl = null;
  let windowEl = null;
  let bodyEl = null;
  let messagesListEl = null;
  let inputEl = null;
  let sendBtnEl = null;
  let charCounterEl = null;
  let piiWarningEl = null;
  let chipsContainerEl = null;
  let typingBubbleEl = null;

  function createWidgetDOM(config, labels, onSend, onEmergency, onRevoke) {
    if (document.getElementById('chatbot-launcher')) return;

    const escape = utils ? utils.escapeHtml : (s) => s;
    const assistantTitle = config?.short_name || 'Asistente IA';
    const emergencyNumber = config?.contacts?.emergency_national || '123';

    // 1. Botón Lanzador
    launcherEl = document.createElement('button');
    launcherEl.id = 'chatbot-launcher';
    launcherEl.className = 'chatbot-launcher';
    launcherEl.setAttribute('aria-label', labels?.chatbot?.launcher_aria || 'Abrir asistente virtual de orientación con IA');
    launcherEl.setAttribute('aria-expanded', 'false');
    launcherEl.innerHTML = `
      <div class="chatbot-launcher-icon" aria-hidden="true">🤖</div>
      <span>${escape(assistantTitle)}</span>
      <span class="chatbot-launcher-badge">IA</span>
    `;
    document.body.appendChild(launcherEl);

    // 2. Ventana del Chat
    windowEl = document.createElement('div');
    windowEl.id = 'chatbot-window';
    windowEl.className = 'chatbot-window hidden';
    windowEl.setAttribute('role', 'dialog');
    windowEl.setAttribute('aria-modal', 'true');
    windowEl.setAttribute('aria-label', 'Ventana del asistente virtual de orientación');

    windowEl.innerHTML = `
      <header class="chatbot-header">
        <div class="chatbot-header-info">
          <div class="chatbot-avatar" aria-hidden="true">🏥</div>
          <div class="chatbot-title-box">
            <h2 class="chatbot-title">${escape(config?.assistant_name || 'Hospital de Ubaté')}</h2>
            <div class="chatbot-subtitle">
              <span>Orientación en línea</span>
              <span class="chatbot-ia-tag">IA</span>
            </div>
          </div>
        </div>
        <div class="chatbot-header-actions">
          <button type="button" class="chatbot-btn-emergency" id="chatbot-header-emergency" aria-label="Llamar a línea de emergencias 123">
            🚨 123
          </button>
          <button type="button" class="chatbot-icon-btn" id="chatbot-btn-options" title="Opciones" aria-label="Opciones del asistente">
            ⚙️
          </button>
          <button type="button" class="chatbot-icon-btn" id="chatbot-btn-close" title="Cerrar" aria-label="Cerrar asistente">
            &times;
          </button>
        </div>
      </header>

      <div class="chatbot-options-menu hidden" id="chatbot-options-menu" style="background:var(--color-surface-elevated);border-bottom:1px solid var(--color-border-subtle);padding:8px 14px;font-size:12px;display:flex;justify-content:space-between;align-items:center;">
        <span>Autorización de datos activa</span>
        <button type="button" class="chatbot-btn-reject" id="btn-revoke-inline" style="padding:4px 8px;font-size:11px;">
          Revocar autorización
        </button>
      </div>

      <div id="chatbot-body" style="flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;">
        <!-- Se inyecta la pantalla de consentimiento o la lista de mensajes -->
      </div>
    `;
    document.body.appendChild(windowEl);

    bodyEl = windowEl.querySelector('#chatbot-body');

    // Manejador de botón cerrar
    windowEl.querySelector('#chatbot-btn-close')?.addEventListener('click', toggleChatbot);

    // Manejador de botón de emergencia del header
    windowEl.querySelector('#chatbot-header-emergency')?.addEventListener('click', () => {
      if (typeof onEmergency === 'function') onEmergency();
      else window.location.href = `tel:${emergencyNumber}`;
    });

    // Menú de opciones / revocación
    const optionsMenu = windowEl.querySelector('#chatbot-options-menu');
    windowEl.querySelector('#chatbot-btn-options')?.addEventListener('click', () => {
      if (optionsMenu) optionsMenu.classList.toggle('hidden');
    });

    windowEl.querySelector('#btn-revoke-inline')?.addEventListener('click', () => {
      if (typeof onRevoke === 'function') onRevoke();
      if (optionsMenu) optionsMenu.classList.add('hidden');
    });

    // Cierre con tecla Escape
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !windowEl.classList.contains('hidden')) {
        toggleChatbot();
      }
    });

    launcherEl.addEventListener('click', toggleChatbot);
  }

  function toggleChatbot() {
    if (!windowEl) return;
    const isHidden = windowEl.classList.contains('hidden');
    if (isHidden) {
      windowEl.classList.remove('hidden');
      launcherEl?.setAttribute('aria-expanded', 'true');
      inputEl?.focus();
    } else {
      windowEl.classList.add('hidden');
      launcherEl?.setAttribute('aria-expanded', 'false');
      launcherEl?.focus();
    }
  }

  function openChatbot() {
    if (!windowEl) return;
    windowEl.classList.remove('hidden');
    launcherEl?.setAttribute('aria-expanded', 'true');
    inputEl?.focus();
  }

  function closeChatbot() {
    if (!windowEl) return;
    windowEl.classList.add('hidden');
    launcherEl?.setAttribute('aria-expanded', 'false');
  }

  function renderConversationView(onSend, config, labels) {
    if (!bodyEl) return;

    bodyEl.innerHTML = `
      <div class="chatbot-messages-view">
        <div class="chatbot-messages-list" id="chatbot-messages-list" role="log" aria-live="polite" aria-label="Mensajes de la conversación">
          <!-- Mensajes dinámicos -->
        </div>

        <div class="chatbot-quick-chips" id="chatbot-quick-chips">
          <!-- Chips de preguntas frecuentes -->
        </div>

        <div class="chatbot-input-bar">
          <div class="chatbot-input-meta">
            <span class="chatbot-pii-warning" id="chatbot-pii-warning">⚠️ No compartas cédulas ni teléfonos en el chat</span>
            <span id="chatbot-char-count">0/500</span>
          </div>
          <div class="chatbot-input-row">
            <textarea
              id="chatbot-input"
              class="chatbot-textarea"
              placeholder="${labels?.chatbot?.input_placeholder || 'Escribe tu consulta aquí...'}"
              rows="1"
              maxlength="${config?.max_message_length || 500}"
              aria-label="Mensaje para el asistente"
            ></textarea>
            <button type="button" id="chatbot-send-btn" class="chatbot-btn-send" aria-label="Enviar mensaje" disabled>
              ➤
            </button>
          </div>
        </div>
      </div>
    `;

    messagesListEl = bodyEl.querySelector('#chatbot-messages-list');
    inputEl = bodyEl.querySelector('#chatbot-input');
    sendBtnEl = bodyEl.querySelector('#chatbot-send-btn');
    charCounterEl = bodyEl.querySelector('#chatbot-char-count');
    piiWarningEl = bodyEl.querySelector('#chatbot-pii-warning');
    chipsContainerEl = bodyEl.querySelector('#chatbot-quick-chips');

    // Input handlers
    inputEl?.addEventListener('input', () => {
      const len = inputEl.value.length;
      const max = config?.max_message_length || 500;
      if (charCounterEl) charCounterEl.textContent = `${len}/${max}`;
      if (sendBtnEl) sendBtnEl.disabled = len === 0;

      // Verificación en tiempo real de PII
      const guard = window.eseb && window.eseb.chatbotGuard;
      if (guard && piiWarningEl) {
        if (guard.containsPII(inputEl.value)) {
          piiWarningEl.classList.add('visible');
        } else {
          piiWarningEl.classList.remove('visible');
        }
      }
    });

    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = inputEl.value.trim();
        if (text && typeof onSend === 'function') {
          onSend(text);
        }
      }
    });

    sendBtnEl?.addEventListener('click', () => {
      const text = inputEl?.value.trim();
      if (text && typeof onSend === 'function') {
        onSend(text);
      }
    });
  }

  function appendUserMessage(text) {
    if (!messagesListEl) return;
    const escape = utils ? utils.escapeHtml : (s) => s;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chatbot-msg chatbot-msg-user';
    msgDiv.innerHTML = `
      <div class="chatbot-bubble">
        <p>${escape(text)}</p>
      </div>
      <div class="chatbot-msg-meta">${timeStr} · Tú</div>
    `;
    messagesListEl.appendChild(msgDiv);
    scrollToBottom();
  }

  function appendAssistantMessage(text, isEmergency = false, hadPII = false, disclaimer = null) {
    if (!messagesListEl) return;
    const escape = utils ? utils.escapeHtml : (s) => s;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chatbot-msg chatbot-msg-assistant';

    let contentHtml = '';

    if (isEmergency) {
      contentHtml = `
        <div class="chatbot-emergency-card">
          <div class="chatbot-emergency-title">🚨 ATENCIÓN DE URGENCIAS</div>
          <p>${escape(text)}</p>
          <div class="chatbot-emergency-actions">
            <a href="tel:123" class="chatbot-btn-call">📞 Llamar al 123</a>
            <a href="tel:6018553300" class="chatbot-btn-call" style="background:var(--color-primary-base);">🏥 Urgencias Ubaté</a>
          </div>
        </div>
      `;
    } else {
      // Formatear párrafos y saltos de línea
      const formatted = escape(text).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
      contentHtml = `
        <div class="chatbot-bubble">
          <p>${formatted}</p>
        </div>
      `;
    }

    let metaNote = '';
    if (hadPII) {
      metaNote = ` · <span style="color:var(--color-status-warning);">Datos protegidos</span>`;
    }

    const defaultDisclaimer = disclaimer || 'IA orientativa · No reemplaza atención médica';

    msgDiv.innerHTML = `
      ${contentHtml}
      <div class="chatbot-msg-meta">${timeStr} · Asistente${metaNote}</div>
      <div class="chatbot-disclaimer-tag">${escape(defaultDisclaimer)}</div>
    `;
    messagesListEl.appendChild(msgDiv);
    scrollToBottom();
  }

  function showTyping() {
    if (!messagesListEl || typingBubbleEl) return;
    typingBubbleEl = document.createElement('div');
    typingBubbleEl.className = 'chatbot-msg chatbot-msg-assistant';
    typingBubbleEl.id = 'chatbot-typing-bubble';
    typingBubbleEl.innerHTML = `
      <div class="chatbot-typing-bubble" aria-label="El asistente está escribiendo...">
        <div class="chatbot-typing-dot"></div>
        <div class="chatbot-typing-dot"></div>
        <div class="chatbot-typing-dot"></div>
      </div>
    `;
    messagesListEl.appendChild(typingBubbleEl);
    scrollToBottom();
  }

  function hideTyping() {
    if (typingBubbleEl) {
      typingBubbleEl.remove();
      typingBubbleEl = null;
    }
  }

  function renderQuickChips(chips, onClick) {
    if (!chipsContainerEl) return;
    const escape = utils ? utils.escapeHtml : (s) => s;
    chipsContainerEl.innerHTML = '';

    chips.forEach(chip => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chatbot-quick-chip';
      btn.textContent = chip.label || chip.question;
      btn.addEventListener('click', () => {
        if (typeof onClick === 'function') onClick(chip);
      });
      chipsContainerEl.appendChild(btn);
    });
  }

  function clearInput() {
    if (inputEl) {
      inputEl.value = '';
      if (charCounterEl) charCounterEl.textContent = '0/500';
      if (sendBtnEl) sendBtnEl.disabled = true;
      if (piiWarningEl) piiWarningEl.classList.remove('visible');
    }
  }

  function setSendDisabled(disabled) {
    if (sendBtnEl) sendBtnEl.disabled = disabled;
    if (inputEl) inputEl.disabled = disabled;
  }

  function scrollToBottom() {
    if (messagesListEl) {
      messagesListEl.scrollTop = messagesListEl.scrollHeight;
    }
  }

  function getBodyContainer() {
    return bodyEl;
  }

  window.eseb.chatbotUI = {
    createWidgetDOM,
    toggleChatbot,
    openChatbot,
    closeChatbot,
    renderConversationView,
    appendUserMessage,
    appendAssistantMessage,
    showTyping,
    hideTyping,
    renderQuickChips,
    clearInput,
    setSendDisabled,
    getBodyContainer
  };
})();
