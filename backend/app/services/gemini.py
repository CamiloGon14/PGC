"""gemini.py — Cliente para Google AI Studio (Gemini 2.5 Flash)
Hospital de Ubaté - Sistema de Gestión Hospitalaria
"""
import json
import logging
import urllib.request
import urllib.error
import anyio
from typing import Dict, Any
from app.core.settings import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Eres el Asistente Virtual Oficial de la E.S.E. Hospital El Salvador de Ubaté (Colombia).
Tu función es EXCLUSIVAMENTE orientar a los usuarios en temas administrativos del formulario de pre-registro de pacientes de urgencias y en la consulta del módulo de acompañante.

REGLAS DE ORO QUE DEBES CUMPLIR SIN EXCEPCIÓN:
1. NO ERES MÉDICO NI SUSTITUYES AL PERSONAL DE SALUD.
2. NUNCA diagnostiques, prescribas, mediques, opines sobre tratamientos ni interpretes síntomas o resultados de laboratorio.
3. Si el usuario te pregunta qué medicamento tomar o qué enfermedad tiene, rechaza cortésmente la solicitud diciendo:
   "Por motivos de seguridad del paciente y cumplimiento del marco legal colombiano, no estoy autorizado para brindar diagnósticos ni formular medicamentos. Por favor consulta directamente con el médico en la sala de urgencias."
4. Si el usuario describe síntomas de peligro o urgencia vital (dolor en el pecho, pérdida de conciencia, dificultad respiratoria severa, sangrado profuso), indícale INMEDIATAMENTE:
   "⚠️ Esta situación puede ser una emergencia médica vital. Acude de inmediato al servicio de urgencias del Hospital de Ubaté o llama a la línea nacional 123."
5. No inventes teléfonos ni horarios. Los canales oficiales son:
   - Línea de emergencias: 123
   - Conmutador Hospital de Ubaté: (601) 855 2222
   - Urgencias: (601) 855 3300
   - Dirección: Carrera 7 # 10-45, Ubaté, Cundinamarca
6. Mantén un tono respetuoso, cálido, profesional, en español claro y conciso (máximo 2 a 3 párrafos cortos).
7. La atención en urgencias se define por la escala de Triage (Resolución 5596 de 2015 del MinSalud), no por orden de llegada.
"""


def _generate_fallback_response(user_message: str, context: str) -> str:
    """Genera una respuesta institucional orientativa cuando no hay API key o hay fallo temporal."""
    msg = user_message.lower()

    if any(k in msg for k in ["motivo", "sintoma", "escribir"]):
        return (
            "En el campo 'Motivo de urgencia' debes escribir de forma breve la razón o molestia principal por la que acudes "
            "(por ejemplo: 'Fiebre alta desde ayer' o 'Dolor abdominal agudo'). No es necesario usar términos técnicos."
        )
    elif any(k in msg for k in ["codigo", "publico", "para que"]):
        return (
            "El Código Público es un identificador de 8 caracteres que se genera al completar el pre-registro. "
            "Permite a tus familiares o acompañantes consultar tu estado y habitación en el Módulo Acompañante sin exponer tu historia clínica."
        )
    elif any(k in msg for k in ["documento", "cedula", "tarjeta", "registro"]):
        return (
            "El sistema acepta Cédula de Ciudadanía (CC), Tarjeta de Identidad (TI), Registro Civil (RC), Cédula de Extranjería (CE), "
            "Pasaporte (PA), Permiso Especial (PEP) o la opción 'Menor sin identificación' si aún no cuenta con documento."
        )
    elif any(k in msg for k in ["activo", "egresado", "estado"]):
        return (
            "En el Módulo Acompañante, el estado 'Activo' indica que el paciente está en atención médica o en sala de observación. "
            "El estado 'Egresado' indica que el personal médico ya autorizó su alta hospitalaria o traslado."
        )
    elif any(k in msg for k in ["horario", "visita", "acompanante"]):
        return (
            "Se permite el acompañamiento permanente prioritariamente a menores de edad, adultos mayores y personas en condición de vulnerabilidad. "
            "Para los demás pacientes, las visitas están sujetas a la capacidad y normas del servicio de urgencias."
        )
    elif any(k in msg for k in ["triage", "tiempo", "espera"]):
        return (
            "En urgencias la atención se prioriza por la gravedad clínica clasificada en el Triage (Rojo: inmediato, Naranja: muy urgente, "
            "Amarillo: urgente, Verde: poco urgente), según la Resolución 5596 de 2015 del Ministerio de Salud."
        )
    elif any(k in msg for k in ["diagnostico", "medicina", "pastilla", "tomar", "duele", "enfermedad"]):
        return (
            "Por motivos de seguridad del paciente y cumplimiento legal, no puedo brindar diagnósticos ni prescribir medicamentos. "
            "Por favor consulta de inmediato con el médico tratante o el personal de enfermería en urgencias."
        )
    else:
        return (
            "El Asistente Virtual del Hospital de Ubaté está disponible para orientarte sobre el pre-registro, el código público "
            "y normas de acompañamiento. Si requieres asistencia presencial, por favor acércate a la ventanilla de admisiones o llama al (601) 855 2222."
        )


def _call_gemini_api_sync(user_message: str, context: str) -> str:
    """Ejecuta la llamada HTTP síncrona a la API de Google AI Studio."""
    api_key = settings.gemini_api_key.strip()
    model = settings.gemini_model.strip() or "gemini-2.5-flash"

    if not api_key or api_key == "tu_api_key_de_google_ai_studio_aqui":
        logger.info("GEMINI_API_KEY no configurada o por defecto. Utilizando respuesta asistida institucional.")
        return _generate_fallback_response(user_message, context)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    context_prompt = f"Contexto de la pantalla actual: El usuario está en la vista de '{context}'.\nMensaje del usuario: {user_message}"

    payload = {
        "system_instruction": {
            "parts": [{"text": SYSTEM_PROMPT}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": context_prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 500,
            "topP": 0.8
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
        ]
    }

    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_body = response.read().decode("utf-8")
            data = json.loads(res_body)

            # Verificar si la respuesta fue bloqueada por filtros de seguridad
            candidates = data.get("candidates", [])
            if not candidates:
                prompt_feedback = data.get("promptFeedback", {})
                if prompt_feedback.get("blockReason"):
                    return "Tu consulta no pudo ser respondida debido a las políticas de seguridad y protección de la institución."
                return "No fue posible generar una respuesta en este momento. Por favor acude al personal de admisiones."

            first_candidate = candidates[0]
            finish_reason = first_candidate.get("finishReason")
            if finish_reason == "SAFETY":
                return "El mensaje fue filtrado por políticas de seguridad institucional."

            parts = first_candidate.get("content", {}).get("parts", [])
            if parts and "text" in parts[0]:
                return parts[0]["text"].strip()

            return _generate_fallback_response(user_message, context)

    except urllib.error.HTTPError as e:
        status_code = e.code
        logger.error(f"Error HTTP {status_code} al llamar a Gemini: {e.reason}")
        if status_code == 429:
            return "El servicio de IA ha alcanzado su límite de cuota temporal. Por favor intenta en unos minutos o consulta en ventanilla."
        if status_code in (401, 403):
            logger.warning("Credenciales de Gemini no válidas. Activando respuesta institucional.")
            return _generate_fallback_response(user_message, context)
        return _generate_fallback_response(user_message, context)
    except Exception as e:
        logger.error(f"Excepción al conectar con Gemini: {str(e)}")
        return _generate_fallback_response(user_message, context)


async def generate_chatbot_response(user_message: str, context: str = "formulario") -> str:
    """Envía la solicitud a Gemini de forma asíncrona sin bloquear el event loop."""
    return await anyio.to_thread.run_sync(_call_gemini_api_sync, user_message, context)
