# Módulos JavaScript

---

## api.js — Cliente HTTP centralizado
Único módulo que se comunica con el backend. Expone todas las funciones en `window.eseb.api`.

| Función | Descripción |
|---------|-------------|
| `registerPatient(data)` | Registrar nuevo paciente |
| `getAllPatients()` | Obtener lista de pacientes |
| `updatePatient(id, data)` | Actualizar datos del paciente |
| `addProcedure(id, desc, by)` | Agregar procedimiento |
| `getProcedures(id)` | Obtener procedimientos |
| `getPatientByPublicCode(code)` | Buscar por código público |
| `verifyAndLogin(token)` | Verificar sesión en backend |
| `getMe()` | Obtener usuario actual |
| `getAllStaff()` | Listar personal |
| `getAuditLogs()` | Ver logs de auditoría |

---

## auth.js — Gestión de sesión
Maneja la sesión del usuario en el navegador usando `sessionStorage`.

| Función | Descripción |
|---------|-------------|
| `currentSession()` | Retorna sesión activa con rol |
| `saveSessionSnapshot()` | Guarda sesión después del login |
| `clearSession()` | Cierra sesión |

---

## staff-panel.js — Panel médico
Contiene toda la lógica del dashboard médico.

| Función | Descripción |
|---------|-------------|
| `showPatientDetail(id)` | Muestra detalle completo del paciente |
| `openArrivalModal()` | Modal confirmar llegada |
| `openAssignRoomModal()` | Modal asignar habitación/camilla |
| `openAssignDoctorModal()` | Modal asignar médico |
| `openAdmitModal()` | Modal marcar ingreso |
| `openDischargeModal()` | Modal marcar egreso |
| `openCompanionModal()` | Modal datos acompañante |
| `openDiagnosisModal()` | Modal diagnóstico final |

---

## companion.js — Vista acompañante
Consulta el estado del paciente usando el código público.

---

## utils.js — Utilidades
Funciones de uso general en todo el sistema.

| Función | Descripción |
|---------|-------------|
| `escapeHtml(str)` | Previene XSS |
| `uid()` | Genera ID único local |
| `formatDate(date)` | Formatea fechas |

---

## theme.js — Conmutador de Tema Claro/Oscuro
Administra el cambio de tema en `data-theme` y su persistencia en `storage.js` respetando la paleta verde hospitalaria y contraste WCAG 2.1 AA.

| Función | Descripción |
|---------|-------------|
| `get()` | Retorna el tema activo actual (`light` o `dark`) |
| `set(theme)` | Aplica y persiste el tema indicado |
| `toggle()` | Alterna entre tema claro y tema oscuro |

---

## Módulos del Chatbot Asistido por IA (`frontend/js/chatbot/`)

| Módulo | Namespace | Descripción |
|--------|-----------|-------------|
| `chatbot-guard.js` | `window.eseb.chatbotGuard` | Detección y enmascaramiento de PII (cédulas, teléfonos) y guardas inmediatas de emergencias vitales (123) |
| `chatbot-context.js` | `window.eseb.chatbotContext` | Inyección contextual para `index.html` (formulario) y `companion.html` (acompañante) |
| `chatbot-consent.js` | `window.eseb.chatbotConsent` | Control del flujo de autorización de datos (Ley 1581), modal legal y opciones de revocación |
| `chatbot-ui.js` | `window.eseb.chatbotUI` | Componente visual del widget flotante, accesibilidad ARIA y renderizado de mensajes |
| `chatbot-core.js` | `window.eseb.chatbotCore` | Orquestador principal, persistencia anónima de sesión y consumo de endpoints vía `api.js` |