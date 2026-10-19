/**
 * chatbot-guard.js — Filtros de seguridad, minimización de datos (PII) y detección de urgencias
 * Hospital de Ubaté - Sistema de Gestión Hospitalaria
 * Cumplimiento Ley 1581 de 2012
 */
(function () {
  window.eseb = window.eseb || {};

  // Expresiones regulares para PII colombiana
  const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
  const PHONE_REGEX = /\b3[0-9]{2}[\s\-]?[0-9]{3}[\s\-]?[0-9]{4}\b/g;
  const DOC_REGEX = /\b(?!20[2-3][0-9]\b)[1-9][0-9]{0,2}(?:\.[0-9]{3}){2}\b|\b(?!20[2-3][0-9]\b)[1-9][0-9]{6,9}\b/g;

  // Palabras clave de urgencias vitales
  const EMERGENCY_TERMS = [
    'paro cardiaco', 'paro cardíaco', 'dolor en el pecho', 'dolor de pecho',
    'infarto', 'no respira', 'dificultad para respirar', 'asfixia', 'ahogando',
    'ahogo', 'inconsciente', 'perdió el conocimiento', 'perdio el conocimiento',
    'desmayo', 'hemorragia', 'sangrado profuso', 'sangrado abundante',
    'convulsion', 'convulsión', 'convulsionando', 'intoxicacion', 'intoxicación',
    'envenenamiento', 'derrame cerebral', 'acv', 'trombosis'
  ];

  function containsPII(text) {
    if (!text || typeof text !== 'string') return false;
    EMAIL_REGEX.lastIndex = 0;
    PHONE_REGEX.lastIndex = 0;
    DOC_REGEX.lastIndex = 0;
    return EMAIL_REGEX.test(text) || PHONE_REGEX.test(text) || DOC_REGEX.test(text);
  }

  function maskPII(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(EMAIL_REGEX, '[CORREO_PROTEGIDO]')
      .replace(PHONE_REGEX, '[TELÉFONO_PROTEGIDO]')
      .replace(DOC_REGEX, '[DOCUMENTO_PROTEGIDO]');
  }

  function isEmergency(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    return EMERGENCY_TERMS.some(term => lower.includes(term));
  }

  window.eseb.chatbotGuard = {
    containsPII,
    maskPII,
    isEmergency,
    EMERGENCY_TERMS
  };
})();
