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

  function findLocalAnswer(rawText) {
    const text = (rawText || '').toLowerCase().trim();
    if (!text) return null;

    // 1. Buscar coincidencia en las preguntas del catálogo FAQ
    if (faqData && Array.isArray(faqData.categories)) {
      for (const cat of faqData.categories) {
        if (!cat.items) continue;
        for (const item of cat.items) {
          const q = (item.question || '').toLowerCase();
          if (text === q || text.includes(q) || q.includes(text)) {
            return item.answer;
          }
        }
      }

      // 2. Buscar por coincidencia de palabras clave (keywords)
      let bestItem = null;
      let maxMatches = 0;
      for (const cat of faqData.categories) {
        if (!cat.items) continue;
        for (const item of cat.items) {
          if (!Array.isArray(item.keywords)) continue;
          const matches = item.keywords.filter(kw => text.includes(kw.toLowerCase())).length;
          if (matches > maxMatches) {
            maxMatches = matches;
            bestItem = item;
          }
        }
      }
      if (bestItem && maxMatches > 0) {
        return bestItem.answer;
      }
    }

    // 3. Respuestas orientativas institucionales generales
    if (/motivo|sintoma|escribir|urgencia/.test(text)) {
      return "En el campo 'Motivo de urgencia' debes escribir de forma breve la razón o molestia principal por la que acudes (por ejemplo: 'Fiebre persistente desde ayer' o 'Dolor abdominal agudo'). No es necesario usar términos técnicos.";
    }
    if (/codigo|publico/.test(text)) {
      return "El Código Público es un identificador de 8 caracteres que se genera al completar el pre-registro. Permite a tus familiares o acompañantes consultar tu estado en el Módulo Acompañante sin exponer tu historia clínica.";
    }
    if (/documento|cedula|tarjeta|registro|ti|cc|rc/.test(text)) {
      return "El sistema acepta Cédula de Ciudadanía (CC), Tarjeta de Identidad (TI), Registro Civil (RC), Cédula de Extranjería (CE), Pasaporte (PA), Permiso Especial (PEP) o la opción 'Menor sin identificación' si aún no cuenta con documento.";
    }
    if (/activo|egresado|estado/.test(text)) {
      return "En el Módulo Acompañante, el estado 'Activo' indica que el paciente está en atención médica o en sala de observación. El estado 'Egresado' indica que el personal médico ya autorizó su alta hospitalaria o traslado.";
    }
    if (/horario|visita|acompanante/.test(text)) {
      return "Se permite el acompañamiento permanente prioritariamente a menores de edad, adultos mayores y personas en condición de vulnerabilidad. Para los demás pacientes, las visitas están sujetas a la capacidad y normas del servicio de urgencias.";
    }
    if (/triage|tiempo|espera/.test(text)) {
      return "En urgencias la atención se prioriza por la gravedad clínica clasificada en el Triage (Rojo: inmediato, Naranja: muy urgente, Amarillo: urgente, Verde: poco urgente), según la Resolución 5596 de 2015 del Ministerio de Salud.";
    }
    if (/diagnostico|medicina|pastilla|tomar|duele|enfermedad/.test(text)) {
      return "Por motivos de seguridad del paciente y cumplimiento legal, no puedo brindar diagnósticos ni prescribir medicamentos. Por favor consulta de inmediato con el médico tratante o el personal de enfermería en urgencias.";
    }

    return null;
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

      // Respuesta orientativa con la base de conocimiento local (FAQ institucional)
      const localAnswer = findLocalAnswer(text);
      if (localAnswer) {
        ui.appendAssistantMessage(
          localAnswer,
          false,
          hasPII,
          configData?.messages?.disclaimer || 'Respuesta generada por asistente orientativo institucional.'
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
