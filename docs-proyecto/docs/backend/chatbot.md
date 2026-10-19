# Backend: Asistente Virtual con IA (Chatbot)

Documentación del módulo de chatbot asistido por Inteligencia Artificial para el Hospital de Ubaté.

---

## 1. Arquitectura y Seguridad de la Integración

El Asistente Virtual utiliza el modelo `gemini-2.5-flash` de Google AI Studio. Para cumplir con el principio de seguridad y la normativa de protección de datos (Ley 1581 de 2012):

1. **Proxy en Backend:** La llave `GEMINI_API_KEY` reside de forma exclusiva en el archivo `backend/.env` y nunca se transmite al navegador ni se expone en el código cliente.
2. **Minimización de Datos:** Antes de consultar el modelo, todo mensaje pasa por `pii_filter.py`, el cual detecta y enmascara cédulas, números telefónicos y correos electrónicos.
3. **Guardas de Urgencia Vital:** Mensajes con sintomatología crítica inminente (paro, dolor en el pecho, asfixia, sangrado severo) son interceptados en el backend y responden de inmediato con alertas de derivación médica a la línea 123 y a Urgencias, sin consultar la API de IA.
4. **Respaldo Institucional (Fallback):** En entornos de desarrollo sin clave configurada o ante fallas temporales de red/cuota, el servicio responde con respuestas institucionales orientativas basadas en FAQs predefinidas.

---

## 2. Variables de Entorno

Configuradas en `backend/.env` y `backend/app/core/settings.py`:

| Variable | Tipo | Valor por defecto | Descripción |
|----------|------|-------------------|-------------|
| `GEMINI_API_KEY` | `str` | `""` | Clave de API de Google AI Studio con facturación activa para entorno clínico |
| `GEMINI_MODEL` | `str` | `"gemini-2.5-flash"` | Modelo de lenguaje de Google utilizado |
| `CHATBOT_RATE_LIMIT` | `int` | `15` | Máximo número de mensajes por minuto permitidos por sesión/IP |

---

## 3. Endpoints del API

Prefijo general: `/chatbot`

### 3.1 Obtener Configuración Pública
- **Método:** `GET /chatbot/config`
- **Acceso:** Público
- **Respuesta (200 OK):**
```json
{
  "status": "ok",
  "consent_version": "1.0",
  "assistant_name": "Asistente Virtual Hospital de Ubaté",
  "max_length": 500,
  "rate_limit_per_minute": 15,
  "contacts": {
    "emergency": "123",
    "hospital_switchboard": "(601) 855 2222",
    "hospital_urgencias": "(601) 855 3300",
    "habeas_data_email": "protecciondatos@hospitalubate.gov.co"
  }
}
```

### 3.2 Registrar Consentimiento de Datos
- **Método:** `POST /chatbot/consent`
- **Acceso:** Público
- **Cuerpo de la Petición:**
```json
{
  "session_id": "uuid-anonimo-de-sesion",
  "consent_version": "1.0",
  "granted": true,
  "context": "formulario",
  "user_agent": "Mozilla/5.0..."
}
```
- **Respuesta (201 Created):** Registra el consentimiento en la tabla `consent_records` guardando hashes criptográficos de la IP y User-Agent para trazabilidad jurídica.

### 3.3 Revocar Consentimiento de Datos
- **Método:** `POST /chatbot/consent/revoke`
- **Acceso:** Público
- **Cuerpo:** `{ "session_id": "uuid-anonimo-de-sesion" }`
- **Respuesta (200 OK):** Marca `revoked_at` con la fecha y hora UTC actual y bloquea de inmediato las peticiones subsiguientes de dicha sesión.

### 3.4 Enviar Mensaje al Asistente
- **Método:** `POST /chatbot/message`
- **Acceso:** Público (requiere consentimiento previo vigente)
- **Validaciones:**
  - Rate limiting (máx. 15 peticiones/minuto por sesión/IP) → `429 Too Many Requests`.
  - Verificación de consentimiento en base de datos → `403 Forbidden` si no existe o fue revocado.
  - Longitud máxima: 500 caracteres.
- **Cuerpo de la Petición:**
```json
{
  "session_id": "uuid-anonimo-de-sesion",
  "message": "¿Qué debo poner en el campo motivo de urgencia?",
  "context": "formulario"
}
```
- **Respuesta (200 OK):**
```json
{
  "response": "En el campo motivo de urgencia debes describir de forma breve...",
  "is_emergency": false,
  "had_pii": false,
  "disclaimer": "Respuesta generada por Inteligencia Artificial orientativa. No constituye consejo médico ni diagnóstico."
}
```

### 3.5 Auditoría de Consentimientos
- **Método:** `GET /chatbot/staff/audit?limit=50`
- **Acceso:** Protegido (Rol `admin`)
- **Respuesta (200 OK):** Lista paginada de registros de autorización y revocación para trazabilidad ante la SIC y auditorías internas.

---

## 4. Servicios Backend

- **`app.services.rate_limit`:** Control en memoria con ventana deslizante de 60 segundos.
- **`app.services.pii_filter`:** Detección de expresiones regulares para cédulas, teléfonos y correos, y catálogo de palabras clave de urgencia.
- **`app.services.gemini`:** Cliente asíncrono con inyección de la instrucción de sistema oficial del hospital, temperatura controlada a 0.2 y filtros de seguridad `BLOCK_MEDIUM_AND_ABOVE`.
