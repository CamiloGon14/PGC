# Arquitectura del backend

El backend sigue una arquitectura en capas basada en FastAPI con Python 3.12.

---

## Estructura de carpetas

    backend/
    ├── app/
    │   ├── main.py          — Punto de entrada, CORS, registro de routers
    │   ├── db.py            — Conexión async a PostgreSQL
    │   ├── dependencies.py  — Autenticación y control de roles
    │   ├── api/
    │   │   ├── patients.py  — Endpoints de pacientes
    │   │   ├── auth.py      — Endpoints de autenticación
    │   │   ├── staff.py     — Endpoints de personal y auditoría
    │   │   └── chatbot.py   — Endpoints del asistente virtual IA
    │   ├── services/
    │   │   ├── gemini.py     — Cliente Google AI Studio (Gemini 2.5 Flash)
    │   │   ├── pii_filter.py — Filtro y enmascaramiento de datos personales
    │   │   └── rate_limit.py — Límite de tasa por sesión/IP
    │   └── models/
    │       ├── patient.py   — Modelo Patient
    │       ├── staff.py     — Modelo Staff
    │       ├── audit.py     — Modelo AuditLog y Procedure
    │       └── consent.py   — Modelo ConsentRecord (Ley 1581)
    ├── alembic/             — Migraciones de base de datos
    ├── .env                 — Variables de entorno
    └── requirements.txt     — Dependencias Python

---

## Flujo de una petición autenticada

1. El frontend envía `Authorization: Bearer {token}` en el header
2. `dependencies.py` valida el token con Firebase Admin SDK
3. Busca el usuario en la tabla `staff` de PostgreSQL
4. Verifica que el rol sea suficiente (`medico` o `admin`)
5. Ejecuta el endpoint y guarda un registro en `audit_logs`
6. Retorna la respuesta al frontend

---

## Variables de entorno requeridas

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de conexión async a PostgreSQL |
| `DATABASE_URL_SYNC` | URL de conexión sync para Alembic |
| `FIREBASE_CREDENTIALS_PATH` | Ruta al archivo de credenciales Firebase |
| `SECRET_KEY` | Clave secreta de la aplicación |
| `ALLOWED_ORIGINS` | Orígenes permitidos para CORS |
| `GEMINI_API_KEY` | Clave de API de Google AI Studio (modelo gemini-2.5-flash) |
| `GEMINI_MODEL` | Nombre del modelo de IA (por defecto `gemini-2.5-flash`) |
| `CHATBOT_RATE_LIMIT` | Límite máximo de mensajes por minuto (por defecto `15`) |