/**
 * chatbot-core.js — Orquestador del ciclo de vida del Asistente Virtual con IA
 * Hospital de Ubaté - Sistema de Gestión Hospitalaria
 */
(function () {
  window.eseb = window.eseb || {};

  const SESSION_KEY = 'eseb_chatbot_session_id';
  const CONSENT_KEY = 'eseb_chatbot_consent_granted';
  const CONSENT_VER_KEY = 'eseb_chatbot_consent_version';

  let configData = null;
  let consentData = null;
  let faqData = null;
  let labelsData = null;

  let currentSessionId = null;
  let currentContext = 'formulario';
  let isSending = false;

  function getOrCreateSessionId() {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        sid = window.crypto.randomUUID();
      } else {
        sid = 'chat-sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
      }
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  }

  function isConsentGranted(expectedVersion) {
    const granted = sessionStorage.getItem(CONSENT_KEY) === 'true';
    const version = sessionStorage.getItem(CONSENT_VER_KEY);
    if (!granted) return false;
    // Si la versión del texto legal cambió, se requiere nueva autorización (CB-06)
    if (expectedVersion && version !== expectedVersion) {
      sessionStorage.removeItem(CONSENT_KEY);
      sessionStorage.removeItem(CONSENT_VER_KEY);
      return false;
    }
    return true;
  }

  function setConsentGranted(granted, version) {
    if (granted) {
      sessionStorage.setItem(CONSENT_KEY, 'true');
      sessionStorage.setItem(CONSENT_VER_KEY, version || '1.0');
    } else {
      sessionStorage.removeItem(CONSENT_KEY);
      sessionStorage.removeItem(CONSENT_VER_KEY);
    }
  }

  async function loadJsonData() {
    try {
      const [resConfig, resConsent, resFaq, resLabels] = await Promise.all([
        fetch('data/chatbot-config.json'),
        fetch('data/consent-text.json'),
        fetch('data/faq.json'),
        fetch('data/ui-labels.json')
      ]);

      if (!resConfig.ok || !resConsent.ok || !resFaq.ok || !resLabels.ok) {
        throw new Error('Falla en la carga de uno o más archivos JSON del chatbot');
      }

      configData = await resConfig.json();
      consentData = await resConsent.json();
      faqData = await resFaq.json();
      labelsData = await resLabels.json();

      return true;
    } catch (err) {
      console.warn('chatbot-core: Deshabilitando chatbot de forma segura debido a falla en JSONs', err);
      return false;
    }
  }

  async function init() {
    const loaded = await loadJsonData();
    if (!loaded) {
      // CB-25: Falla de carga de JSON -> no inicializa el widget para no operar con datos inconsistentes
      return;
    }

    currentSessionId = getOrCreateSessionId();

    const ctxModule = window.eseb && window.eseb.chatbotContext;
    currentContext = ctxModule ? ctxModule.getCurrentContext() : 'formulario';

    const ui = window.eseb && window.eseb.chatbotUI;
    if (!ui) {
      console.warn('chatbot-core: falta módulo chatbotUI');
      return;
    }

    // Crear elementos en DOM
    ui.createWidgetDOM(
      configData,
      labelsData,
      handleSendMessage,
      handleEmergencyCall,
      handleRevokeConsent
    );

    // Verificar estado de autorización
    const legalVersion = consentData.version || '1.0';
    if (isConsentGranted(legalVersion)) {
      startConversationView();
    } else {
      showConsentView();
    }
  }

  function showConsentView() {
    const ui = window.eseb.chatbotUI;
    const consentModule = window.eseb.chatbotConsent;
    const container = ui.getBodyContainer();

    consentModule.renderConsentScreen(
      container,
      consentData,
      configData,
      handleAcceptConsent,
      handleRejectConsent
    );
  }

  async function handleAcceptConsent({ isMinorRepresentative, version }) {
    const api = window.eseb.api;
    try {
      if (api && typeof api.chatbotConsent === 'function') {
        await api.chatbotConsent({
          sessionId: currentSessionId,
          consentVersion: version || '1.0',
          granted: true,
          context: currentContext
        });
      }
    } catch (e) {
      console.warn('chatbot-core: no se pudo guardar consentimiento en backend, continuando en modo local', e);
    }

    setConsentGranted(true, version);
    startConversationView();
  }

  async function handleRejectConsent({ version }) {
    const api = window.eseb.api;
    try {
      if (api && typeof api.chatbotConsent === 'function') {
        await api.chatbotConsent({
          sessionId: currentSessionId,
          consentVersion: version || '1.0',
          granted: false,
          context: currentContext
        });
      }
    } catch (e) {
      console.warn('chatbot-core: no se pudo registrar rechazo en backend', e);
    }

    setConsentGranted(false);
    const ui = window.eseb.chatbotUI;
    const consentModule = window.eseb.chatbotConsent;
    consentModule.renderRejectionScreen(ui.getBodyContainer(), configData, () => {
      showConsentView();
    });
  }

  async function handleRevokeConsent() {
    const api = window.eseb.api;
    try {
      if (api && typeof api.chatbotRevokeConsent === 'function') {
        await api.chatbotRevokeConsent({ sessionId: currentSessionId });
      }
    } catch (e) {
      console.warn('chatbot-core: error al revocar en backend', e);
    }

    setConsentGranted(false);
    showConsentView();

    const ui = window.eseb.chatbotUI;
    ui.appendAssistantMessage(
      configData?.messages?.consent_revoked || 'Has revocado la autorización de tratamiento de datos. El chat ha sido deshabilitado.'
    );
  }

  function handleEmergencyCall() {
    const num = configData?.contacts?.emergency_national || '123';
    window.location.href = `tel:${num}`;
  }

  function startConversationView() {
    const ui = window.eseb.chatbotUI;
    const ctxModule = window.eseb.chatbotContext;

    ui.renderConversationView(handleSendMessage, configData, labelsData);

    // Mensaje inicial de bienvenida
    const welcome = ctxModule
      ? ctxModule.getWelcomeMessage(currentContext, configData)
      : configData.welcome_greeting;
    ui.appendAssistantMessage(welcome, false, false, configData?.messages?.disclaimer);

    // Chips contextuales de FAQ
    if (ctxModule && faqData) {
      const chips = ctxModule.getContextualPrompts(currentContext, faqData);
      ui.renderQuickChips(chips, (selectedChip) => {
        handleSendMessage(selectedChip.question);
      });
    }
  }

  async function handleSendMessage(rawText) {
    if (isSending || !rawText || !rawText.trim()) return;

    const ui = window.eseb.chatbotUI;
    const guard = window.eseb.chatbotGuard;
    const text = rawText.trim();

    ui.clearInput();

    // 1. Detección inmediata de urgencia vital en el cliente
    if (guard && guard.isEmergency(text)) {
      ui.appendUserMessage(text);
      ui.appendAssistantMessage(
        configData?.messages?.emergency_alert ||
        '⚠️ ALERTA DE URGENCIAS: Si presentas síntomas de gravedad, acude de inmediato a Urgencias o llama al 123.',
        true
      );
      return;
    }

    // 2. Verificación de PII
    const hasPII = guard ? guard.containsPII(text) : false;
    const textToSend = guard && hasPII ? guard.maskPII(text) : text;

    ui.appendUserMessage(text);
    ui.showTyping();
    ui.setSendDisabled(true);
    isSending = true;

    try {
      const api = window.eseb.api;
      if (!api || typeof api.chatbotSendMessage !== 'function') {
        throw new Error('API del chatbot no disponible');
      }

      const res = await api.chatbotSendMessage({
        sessionId: currentSessionId,
        message: textToSend,
        context: currentContext
      });

      ui.hideTyping();
      ui.appendAssistantMessage(
        res.response,
        res.is_emergency,
        hasPII || res.had_pii,
        res.disclaimer
      );

    } catch (err) {
      ui.hideTyping();
      const errMsg = err.message || '';

      if (errMsg.includes('403') || errMsg.includes('autorización')) {
        setConsentGranted(false);
        showConsentView();
        return;
      }

      if (errMsg.includes('429') || errMsg.includes('límite')) {
        ui.appendAssistantMessage(
          configData?.messages?.rate_limit_exceeded ||
          'Has alcanzado el límite de consultas por minuto. Por favor espera un momento.',
          false
        );
        return;
      }

      // Error genérico o sin conexión
      ui.appendAssistantMessage(
        configData?.messages?.service_error ||
        'El servicio no está disponible temporalmente. Puedes consultar con el personal en ventanilla de admisiones.',
        false
      );
    } finally {
      ui.setSendDisabled(false);
      isSending = false;
    }
  }

  // Auto-inicialización
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.eseb.chatbotCore = {
    init,
    open: () => window.eseb.chatbotUI?.openChatbot(),
    close: () => window.eseb.chatbotUI?.closeChatbot(),
    toggle: () => window.eseb.chatbotUI?.toggleChatbot(),
    revoke: handleRevokeConsent
  };
})();
