/**
 * chatbot-consent.js — Gestión del flujo de autorización de tratamiento de datos personales
 * Hospital de Ubaté - Cumplimiento Ley 1581 de 2012 y Decreto 1377 de 2013
 */
(function () {
  window.eseb = window.eseb || {};
  const utils = window.eseb && window.eseb.utils;

  function renderConsentScreen(container, consentData, configData, onAccept, onReject) {
    if (!container || !consentData) return;

    const escape = utils ? utils.escapeHtml : (s) => s;
    const bulletsHtml = (consentData.bullet_points || [])
      .map(b => `<li>${escape(b)}</li>`)
      .join('');

    container.innerHTML = `
      <div class="chatbot-consent-view" id="chatbot-consent-view">
        <div class="chatbot-consent-badge">
          <span>⚖️</span> Protección de Datos Personales
        </div>
        <h3 class="chatbot-consent-title">Autorización previa e informada</h3>
        <p class="chatbot-consent-desc">${escape(consentData.short_summary || '')}</p>

        <ul class="chatbot-contact-list" style="font-size: 11px; color: var(--color-text-secondary); line-height: 1.45;">
          ${bulletsHtml}
        </ul>

        <div class="chatbot-consent-alert">
          <strong>⚠️ Aviso Importante:</strong> El asistente NO es personal médico y no reemplaza la valoración en urgencias. Nunca ingreses cédulas, teléfonos ni información clínica confidencial.
        </div>

        <button type="button" class="chatbot-legal-link" id="btn-view-legal-terms">
          📄 Ver términos completos y política de privacidad (Ley 1581)
        </button>

        <form class="chatbot-consent-form" id="chatbot-consent-form">
          <label class="chatbot-check-label">
            <input type="checkbox" id="chat-consent-check" required />
            <span>${escape(consentData.checkboxes?.consent_required || 'Autorizo el tratamiento de mis datos personales para recibir asistencia virtual.')}</span>
          </label>

          <label class="chatbot-check-label">
            <input type="checkbox" id="chat-minor-check" />
            <span style="font-size: 11px; color: var(--color-text-muted);">${escape(consentData.checkboxes?.minor_representative || 'Declaro ser representante legal en caso de menor de edad.')}</span>
          </label>

          <div class="chatbot-consent-btn-group">
            <button type="button" class="chatbot-btn-accept" id="btn-consent-accept" disabled>
              Aceptar y continuar
            </button>
            <button type="button" class="chatbot-btn-reject" id="btn-consent-reject">
              No autorizo / Continuar sin asistente
            </button>
          </div>
        </form>
      </div>
    `;

    // Manejadores de eventos
    const checkConsent = container.querySelector('#chat-consent-check');
    const btnAccept = container.querySelector('#btn-consent-accept');
    const btnReject = container.querySelector('#btn-consent-reject');
    const btnTerms = container.querySelector('#btn-view-legal-terms');

    if (checkConsent && btnAccept) {
      checkConsent.addEventListener('change', () => {
        btnAccept.disabled = !checkConsent.checked;
      });
    }

    if (btnAccept) {
      btnAccept.addEventListener('click', () => {
        if (checkConsent && checkConsent.checked) {
          const isMinorRep = container.querySelector('#chat-minor-check')?.checked || false;
          if (typeof onAccept === 'function') {
            onAccept({ isMinorRepresentative: isMinorRep, version: consentData.version });
          }
        }
      });
    }

    if (btnReject) {
      btnReject.addEventListener('click', () => {
        if (typeof onReject === 'function') {
          onReject({ version: consentData.version });
        }
      });
    }

    if (btnTerms) {
      btnTerms.addEventListener('click', () => {
        openFullTermsModal(consentData);
      });
    }
  }

  function renderRejectionScreen(container, configData, onRetry) {
    if (!container) return;
    const escape = utils ? utils.escapeHtml : (s) => s;
    const contacts = (configData && configData.contacts) || {};

    container.innerHTML = `
      <div class="chatbot-consent-view">
        <div class="chatbot-consent-badge" style="background: var(--color-status-warning-bg); color: var(--color-status-warning); border-color: var(--color-status-warning);">
          <span>🔒</span> Asistente no habilitado
        </div>
        <h3 class="chatbot-consent-title">No has autorizado el tratamiento de datos</h3>
        <p class="chatbot-consent-desc">
          Respetamos tu decisión. Conforme a la Ley 1581 de 2012, no es posible habilitar la conversación con el asistente virtual sin autorización previa.
        </p>

        <div class="chatbot-rejected-box">
          <strong>Canales presenciales y telefónicos disponibles:</strong>
          <ul class="chatbot-contact-list">
            <li><strong>Urgencias:</strong> ${escape(contacts.hospital_urgencias || '(601) 855 3300')}</li>
            <li><strong>Conmutador:</strong> ${escape(contacts.hospital_switchboard || '(601) 855 2222')}</li>
            <li><strong>Dirección:</strong> ${escape(contacts.hospital_address || 'Carrera 7 # 10-45, Ubaté')}</li>
            <li><strong>Línea de emergencia:</strong> 123</li>
          </ul>
          <p style="margin: 0; color: var(--color-text-muted);">
            Puedes continuar utilizando el formulario de pre-registro o la consulta de acompañante sin inconvenientes.
          </p>
        </div>

        <div style="margin-top: 10px;">
          <button type="button" class="chatbot-btn-accept" id="btn-reconsider-consent" style="width: 100%;">
            Revisar autorización nuevamente
          </button>
        </div>
      </div>
    `;

    const btnRetry = container.querySelector('#btn-reconsider-consent');
    if (btnRetry && typeof onRetry === 'function') {
      btnRetry.addEventListener('click', onRetry);
    }
  }

  function openFullTermsModal(consentData) {
    const existing = document.getElementById('chatbot-legal-modal');
    if (existing) existing.remove();

    const terms = consentData.full_legal_terms || {};
    const sectionsHtml = (terms.sections || []).map(sec => `
      <h4>${sec.heading}</h4>
      <p>${sec.content}</p>
    `).join('');

    const modal = document.createElement('div');
    modal.className = 'chatbot-legal-modal';
    modal.id = 'chatbot-legal-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'legal-modal-title');

    modal.innerHTML = `
      <div class="chatbot-legal-card">
        <div class="chatbot-legal-header">
          <h3 id="legal-modal-title">${terms.title || 'Términos de Tratamiento de Datos'}</h3>
          <button class="chatbot-icon-btn" id="btn-close-legal" aria-label="Cerrar">&times;</button>
        </div>
        <div class="chatbot-legal-body">
          <p><strong>Responsable:</strong> ${consentData.responsible || 'Hospital de Ubaté'}</p>
          <p><strong>Fecha de vigencia:</strong> ${consentData.effective_date || 'Mayo 2026'} | <strong>Versión:</strong> ${consentData.version || '1.0'}</p>
          ${sectionsHtml}
        </div>
        <div class="chatbot-legal-footer">
          <button class="chatbot-btn-accept" id="btn-understand-legal" style="padding: 6px 16px;">Entendido</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#btn-close-legal')?.addEventListener('click', close);
    modal.querySelector('#btn-understand-legal')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }

  window.eseb.chatbotConsent = {
    renderConsentScreen,
    renderRejectionScreen,
    openFullTermsModal
  };
})();
