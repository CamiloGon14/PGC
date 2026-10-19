/**
 * chatbot-context.js — Proveedor de contexto por pantalla
 * Hospital de Ubaté - Sistema de Gestión Hospitalaria
 */
(function () {
  window.eseb = window.eseb || {};

  function getCurrentContext() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('companion')) {
      return 'acompanante';
    }
    return 'formulario';
  }

  function getContextualPrompts(context, faqData) {
    if (!faqData || !faqData.categories) return [];

    const categoryId = context === 'acompanante' ? 'acompanante' : 'pre_registro';
    const cat = faqData.categories.find(c => c.id === categoryId);
    if (!cat || !cat.items) return [];

    return cat.items.slice(0, 4).map(item => ({
      id: item.id,
      label: item.question,
      question: item.question,
      answer: item.answer
    }));
  }

  function getWelcomeMessage(context, configData) {
    if (!configData) return 'Hola, ¿en qué puedo orientarte hoy?';
    if (context === 'acompanante') {
      return configData.welcome_greeting_companion || configData.welcome_greeting;
    }
    return configData.welcome_greeting;
  }

  window.eseb.chatbotContext = {
    getCurrentContext,
    getContextualPrompts,
    getWelcomeMessage
  };
})();
