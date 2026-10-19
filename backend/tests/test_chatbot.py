"""test_chatbot.py — Pruebas automatizadas para el Chatbot Asistido por IA
Hospital de Ubaté - Cobertura de casos CB-01 a CB-25
"""
import uuid
import json
import os
import pytest
import httpx
from app.main import app
from app.services.rate_limit import reset_rate_limit
from app.services.pii_filter import mask_pii, is_medical_emergency

pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def reset_limits():
    """Limpia el rate limiter antes de cada prueba."""
    reset_rate_limit()


@pytest.fixture
async def client():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


# ── 1. Configuración Pública ──────────────────────────────

async def test_get_chatbot_config(client):
    """CB-06: Consulta de configuración y versión activa del texto legal."""
    res = await client.get("/chatbot/config")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["consent_version"] == "1.0"
    assert "assistant_name" in data
    assert data["contacts"]["emergency"] == "123"


# ── 2. Flujo de Consentimiento (CB-01, CB-02, CB-03, CB-04, CB-05) ────

async def test_message_without_consent_returns_403(client):
    """CB-04: Enviar mensaje sin consentimiento previo debe retornar 403 Forbidden."""
    unauthorized_session = f"session-no-consent-{uuid.uuid4()}"
    res = await client.post("/chatbot/message", json={
        "session_id": unauthorized_session,
        "message": "¿Cómo pre-registrarme?",
        "context": "formulario"
    })
    assert res.status_code == 403
    assert "autorización" in res.json()["detail"].lower()


async def test_grant_consent_and_send_message(client):
    """CB-03 y CB-08: Aceptar consentimiento permite enviar mensajes y recibir orientación."""
    session_id = f"session-ok-{uuid.uuid4()}"

    # 1. Registrar consentimiento otorgado
    consent_res = await client.post("/chatbot/consent", json={
        "session_id": session_id,
        "consent_version": "1.0",
        "granted": True,
        "context": "formulario",
        "user_agent": "Pytest-Agent"
    })
    assert consent_res.status_code == 201
    assert consent_res.json()["granted"] is True

    # 2. Enviar mensaje de consulta sobre pre-registro
    msg_res = await client.post("/chatbot/message", json={
        "session_id": session_id,
        "message": "¿Qué debo poner en el campo motivo de urgencia?",
        "context": "formulario"
    })
    assert msg_res.status_code == 200
    data = msg_res.json()
    assert "response" in data
    assert len(data["response"]) > 10
    assert data["is_emergency"] is False
    assert "disclaimer" in data


async def test_reject_consent_persists_decision(client):
    """CB-02: Registrar rechazo de consentimiento."""
    session_id = f"session-reject-{uuid.uuid4()}"

    res = await client.post("/chatbot/consent", json={
        "session_id": session_id,
        "consent_version": "1.0",
        "granted": False,
        "context": "acompanante"
    })
    assert res.status_code == 201
    assert res.json()["granted"] is False

    # Mensaje subsiguiente debe ser denegado con 403
    msg_res = await client.post("/chatbot/message", json={
        "session_id": session_id,
        "message": "Hola",
        "context": "acompanante"
    })
    assert msg_res.status_code == 403


async def test_revoke_consent(client):
    """CB-05: Revocar consentimiento detiene el chat y bloquea mensajes posteriores."""
    session_id = f"session-revoke-{uuid.uuid4()}"

    # Autorizar
    await client.post("/chatbot/consent", json={
        "session_id": session_id,
        "consent_version": "1.0",
        "granted": True,
        "context": "formulario"
    })

    # Verificar que funciona
    res1 = await client.post("/chatbot/message", json={
        "session_id": session_id,
        "message": "Hola",
        "context": "formulario"
    })
    assert res1.status_code == 200

    # Revocar
    revoke_res = await client.post("/chatbot/consent/revoke", json={
        "session_id": session_id
    })
    assert revoke_res.status_code == 200
    assert revoke_res.json()["status"] == "revoked"

    # Intentar enviar mensaje tras revocación
    res2 = await client.post("/chatbot/message", json={
        "session_id": session_id,
        "message": "Hola de nuevo",
        "context": "formulario"
    })
    assert res2.status_code == 403


# ── 3. Guardas y Seguridad (CB-10, CB-11, CB-12, CB-18) ────────

async def test_emergency_detection_bypasses_model(client):
    """CB-11: Síntomas graves activan de inmediato la alerta fija de derivación médica a 123."""
    session_id = f"session-urg-{uuid.uuid4()}"
    await client.post("/chatbot/consent", json={
        "session_id": session_id,
        "consent_version": "1.0",
        "granted": True,
        "context": "formulario"
    })

    res = await client.post("/chatbot/message", json={
        "session_id": session_id,
        "message": "Ayuda, tengo dolor en el pecho agudo y me desmayé",
        "context": "formulario"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_emergency"] is True
    assert "123" in data["response"]
    assert "urgencias" in data["response"].lower()


def test_pii_masking():
    """CB-12: Detección y enmascaramiento de cédulas y teléfonos."""
    raw = "Mi cédula es 1070987654 y mi celular 3101234567, correo juan@example.com"
    masked, had_pii = mask_pii(raw)
    assert had_pii is True
    assert "1070987654" not in masked
    assert "3101234567" not in masked
    assert "juan@example.com" not in masked
    assert "[DOCUMENTO_PROTEGIDO]" in masked
    assert "[TELEFONO_PROTEGIDO]" in masked
    assert "[CORREO_PROTEGIDO]" in masked


async def test_clinical_limits_no_prescription(client):
    """CB-10: Solicitudes de prescripción o diagnóstico deben ser rechazadas amablemente."""
    session_id = f"session-dx-{uuid.uuid4()}"
    await client.post("/chatbot/consent", json={
        "session_id": session_id,
        "consent_version": "1.0",
        "granted": True,
        "context": "formulario"
    })

    res = await client.post("/chatbot/message", json={
        "session_id": session_id,
        "message": "¿Qué pastilla o medicina debo tomar para el dolor de estómago?",
        "context": "formulario"
    })
    assert res.status_code == 200
    text = res.json()["response"].lower()
    # Verifica que no receta y deriva al personal médico
    assert ("no puedo" in text or "no estoy autorizado" in text or "seguridad" in text or "médico" in text)


async def test_rate_limiting_burst(client):
    """CB-18: Una ráfaga superior al límite por minuto genera 429 Too Many Requests."""
    session_id = f"session-burst-{uuid.uuid4()}"
    await client.post("/chatbot/consent", json={
        "session_id": session_id,
        "consent_version": "1.0",
        "granted": True,
        "context": "formulario"
    })

    got_429 = False
    for i in range(25):
        res = await client.post("/chatbot/message", json={
            "session_id": session_id,
            "message": f"Consulta repetitiva número {i}",
            "context": "formulario"
        })
        if res.status_code == 429:
            got_429 = True
            break

    assert got_429 is True


# ── 4. Validación de JSONs de Frontend (CB-25) ──────────────────

def test_frontend_json_files_integrity():
    """CB-25: Verificar que todos los archivos JSON requeridos existan y sean válidos."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    frontend_data_dir = os.path.join(os.path.dirname(base_dir), "frontend", "data")

    required_files = [
        "chatbot-config.json",
        "consent-text.json",
        "faq.json",
        "navigation.json",
        "ui-labels.json"
    ]

    for fname in required_files:
        fpath = os.path.join(frontend_data_dir, fname)
        assert os.path.exists(fpath), f"Falta archivo requerido: {fname}"
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
            assert "version" in data, f"El archivo {fname} debe tener campo version"
