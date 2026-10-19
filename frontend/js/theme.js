/**
 * theme.js — Conmutador de tema Claro / Oscuro
 * Hospital de Ubaté - Sistema de Gestión Hospitalaria
 * Integrado con storage.js y tokens.css
 */
(function () {
  window.eseb = window.eseb || {};

  const THEME_STORAGE_KEY = 'eseb_theme';
  const THEMES = {
    LIGHT: 'light',
    DARK: 'dark'
  };

  function getSystemPreference() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return THEMES.DARK;
    }
    return THEMES.LIGHT;
  }

  function getStoredTheme() {
    try {
      const storage = window.eseb && window.eseb.storage;
      if (storage && typeof storage.read === 'function') {
        const stored = storage.read(THEME_STORAGE_KEY);
        if (stored === THEMES.LIGHT || stored === THEMES.DARK) return stored;
      }
      const direct = localStorage.getItem(THEME_STORAGE_KEY);
      if (direct === THEMES.LIGHT || direct === THEMES.DARK) return direct;
    } catch (e) {
      console.warn('theme: no se pudo leer localStorage', e);
    }
    return null;
  }

  function applyTheme(theme, save = false) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (document.body) {
      document.body.setAttribute('data-theme', theme);
    }

    if (save) {
      try {
        const storage = window.eseb && window.eseb.storage;
        if (storage && typeof storage.write === 'function') {
          storage.write(THEME_STORAGE_KEY, theme);
        } else {
          localStorage.setItem(THEME_STORAGE_KEY, theme);
        }
      } catch (e) {
        console.warn('theme: no se pudo guardar preferencia', e);
      }
    }

    updateToggleButtons(theme);
    window.dispatchEvent(new CustomEvent('eseb:theme', { detail: { theme } }));
  }

  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || THEMES.LIGHT;
  }

  function toggleTheme() {
    const current = getCurrentTheme();
    const next = current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    applyTheme(next, true);
    return next;
  }

  function updateToggleButtons(theme) {
    const isDark = theme === THEMES.DARK;
    const buttons = document.querySelectorAll('[data-action="toggle-theme"], .btn-theme-toggle');
    buttons.forEach(btn => {
      btn.setAttribute('aria-label', isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
      btn.setAttribute('title', isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
      const textSpan = btn.querySelector('.theme-text');
      if (textSpan) {
        textSpan.textContent = isDark ? 'Modo Claro' : 'Modo Oscuro';
      }
      const iconSpan = btn.querySelector('.theme-icon');
      if (iconSpan) {
        iconSpan.textContent = isDark ? '☀️' : '🌙';
      }
    });
  }

  // Inicializar tema de inmediato al cargar el script
  const initial = getStoredTheme() || getSystemPreference();
  applyTheme(initial, false);

  // Escuchar cambios de preferencia del sistema si el usuario no tiene una guardada
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!getStoredTheme()) {
        applyTheme(e.matches ? THEMES.DARK : THEMES.LIGHT, false);
      }
    });
  }

  // Configurar listeners en el DOM cuando esté listo
  document.addEventListener('DOMContentLoaded', () => {
    updateToggleButtons(getCurrentTheme());
    document.addEventListener('click', (ev) => {
      const target = ev.target.closest('[data-action="toggle-theme"], .btn-theme-toggle');
      if (target) {
        ev.preventDefault();
        toggleTheme();
      }
    });
  });

  window.eseb.theme = {
    get: getCurrentTheme,
    set: (t) => applyTheme(t, true),
    toggle: toggleTheme,
    THEMES
  };
})();
