# Frontend: Widget del Asistente Virtual y Gestión de Temas

Documentación de la arquitectura del cliente, componentes vanilla modular, sistema de diseño y manejo de datos mediante JSON.

---

## 1. Módulos JavaScript (`frontend/js/chatbot/`)

El widget está desacoplado en cinco submódulos orientados a responsabilidad única bajo el espacio de nombres `window.eseb`:

| Archivo | Namespace | Responsabilidad |
|---------|-----------|-----------------|
| `chatbot-guard.js` | `window.eseb.chatbotGuard` | Filtros de minimización de datos en cliente (`containsPII`, `maskPII`) y detección inmediata de urgencias vitales (`isEmergency`). |
| `chatbot-context.js` | `window.eseb.chatbotContext` | Inyección contextual según la URL (`formulario` en pre-registro vs. `acompanante` en consulta) y selección de preguntas sugeridas. |
| `chatbot-consent.js` | `window.eseb.chatbotConsent` | Renderizado de la pantalla previa obligatoria de autorización (Ley 1581), modal con texto legal íntegro y pantalla de rechazo con canales alternos. |
| `chatbot-ui.js` | `window.eseb.chatbotUI` | Creación y control del DOM del lanzador flotante, ventana modal, burbujas de conversación, indicador de escritura animado y soporte de accesibilidad ARIA. |
| `chatbot-core.js` | `window.eseb.chatbotCore` | Orquestador principal, manejo de sesión anónima en `sessionStorage`, ciclo de vida, llamada a la API y resiliencia ante errores. |

---

## 2. Gestión de Datos mediante JSON (`frontend/data/`)

Todo el contenido visual, legal y de configuración se extrae de archivos JSON para evitar hardcoding en código:

| Archivo | Contenido | Versión |
|---------|-----------|---------|
| `chatbot-config.json` | Nombre institucional, saludos de bienvenida, longitud máxima de mensaje (500 caracteres), tiempos de inactividad, teléfonos de urgencias y mensajes de contingencia. | `1.0.0` |
| `consent-text.json` | Texto de autorización previa, expresa e informada de conformidad con la Ley 1581 de 2012 y el Decreto 1377 de 2013, cláusulas sobre transmisión internacional a Gemini, derechos ARCO y etiquetas de casillas. | `1.0` |
| `faq.json` | Banco categorizado de preguntas frecuentes (`pre_registro`, `acompanante`, `triage_general`). Alimenta tanto las sugerencias de la interfaz (chips) como el contexto del asistente. | `1.0.0` |
| `navigation.json` | Definición del menú principal, drawer lateral y acciones rápidas institucionales. | `1.0.0` |
| `ui-labels.json` | Diccionario de etiquetas de accesibilidad, atributos `aria-label`, textos de botones y placeholders. | `1.0.0` |

---

## 3. Sistema de Diseño y Tokens CSS (`frontend/css/`)

- **`tokens.css`:**
  - Paleta en tonalidades verdes institucionales: `--color-primary-base` (`#00875A`), `--color-primary-dark` (`#005A3C`), `--color-accent` (`#00A3A3`).
  - Cumplimiento estricto del ratio de contraste **WCAG 2.1 AA** (mínimo 4.5:1 para texto estándar y 3:1 para texto de gran tamaño y elementos interactivos).
  - Variables semánticas de superficie, bordes, estados funcionales y sombras elevadas.
- **`chatbot.css`:**
  - Botón flotante accesible (`#chatbot-launcher`) con badge indicador de IA.
  - Ventana flotante (`#chatbot-window`) con scroll suave, botón de llamada de urgencia rápida (`🚨 123`) y menú de opciones para revocación.
  - Adaptabilidad para dispositivos móviles (ancho completo y disposición táctil amigable).
- **`theme.js`:**
  - Conmutador accesible de tema Claro / Oscuro.
  - Almacenamiento de preferencia en `storage.js` (`eseb_theme`).
  - Detección automática de preferencia del sistema operativo mediante `window.matchMedia('(prefers-color-scheme: dark)')`.
