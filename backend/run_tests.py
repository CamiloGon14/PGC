"""run_tests.py — Ejecutor de pruebas directas para el Chatbot del Hospital de Ubaté
Cubre casos de prueba CB-01 a CB-25 de la matriz IEEE 829
"""
import asyncio
import os
import json
import uuid
import httpx
from app.main import app
from app.services.rate_limit import reset_rate_limit
from app.services.pii_filter import mask_pii, is_medical_emergency


async def main():
    print("=" * 60)
    print("INICIANDO BATERÍA DE PRUEBAS DEL CHATBOT - HOSPITAL DE UBATÉ")
    print("=" * 60)

    total_tests = 0
    passed_tests = 0

    def assert_test(name, condition, details=""):
        nonlocal total_tests, passed_tests
        total_tests += 1
        if condition:
            passed_tests += 1
            print(f" [PASS] {name}")
        else:
            print(f" [FAIL] {name} - Detalle: {details}")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:

        # ── CB-06: Configuración y versión legal ─────────────────
        res = await client.get("/chatbot/config")
        data = res.json()
        assert_test("CB-06: Endpoint config retorna versión legal 1.0", res.status_code == 200 and data.get("consent_version") == "1.0")
        assert_test("CB-06: Canal de emergencia configurado como 123", data.get("contacts", {}).get("emergency") == "123")

        # ── CB-04: Mensaje sin consentimiento ────────────────────
        unauth_session = f"session-no-consent-{uuid.uuid4()}"
        res = await client.post("/chatbot/message", json={
            "session_id": unauth_session,
            "message": "¿Cómo me registro?",
            "context": "formulario"
        })
        assert_test("CB-04: Enviar mensaje sin consentimiento retorna 403 Forbidden", res.status_code == 403)

        # ── CB-03 y CB-08: Aceptar consentimiento y consultar ───
        session_ok = f"session-ok-{uuid.uuid4()}"
        res_consent = await client.post("/chatbot/consent", json={
            "session_id": session_ok,
            "consent_version": "1.0",
            "granted": True,
            "context": "formulario"
        })
        assert_test("CB-03: Registrar consentimiento otorgado retorna 201 Created", res_consent.status_code == 201 and res_consent.json().get("granted") is True)

        res_msg = await client.post("/chatbot/message", json={
            "session_id": session_ok,
            "message": "¿Qué debo poner en el campo motivo de urgencia?",
            "context": "formulario"
        })
        data_msg = res_msg.json()
        assert_test("CB-08: Asistente responde con orientación en pre-registro", res_msg.status_code == 200 and len(data_msg.get("response", "")) > 10)
        assert_test("CB-08: Mensaje incluye descargo de responsabilidad de IA", "disclaimer" in data_msg and data_msg.get("is_emergency") is False)

        # ── CB-02: Rechazar consentimiento ───────────────────────
        session_reject = f"session-reject-{uuid.uuid4()}"
        res_rej = await client.post("/chatbot/consent", json={
            "session_id": session_reject,
            "consent_version": "1.0",
            "granted": False,
            "context": "acompanante"
        })
        assert_test("CB-02: Registrar rechazo de consentimiento retorna 201 y granted=false", res_rej.status_code == 201 and res_rej.json().get("granted") is False)

        res_rej_msg = await client.post("/chatbot/message", json={
            "session_id": session_reject,
            "message": "Hola",
            "context": "acompanante"
        })
        assert_test("CB-02: Chat permanece deshabilitado tras rechazo (403)", res_rej_msg.status_code == 403)

        # ── CB-05: Revocar consentimiento ────────────────────────
        session_rev = f"session-rev-{uuid.uuid4()}"
        await client.post("/chatbot/consent", json={
            "session_id": session_rev,
            "consent_version": "1.0",
            "granted": True,
            "context": "formulario"
        })
        res_rev = await client.post("/chatbot/consent/revoke", json={"session_id": session_rev})
        assert_test("CB-05: Revocación de consentimiento retorna 200 OK y status=revoked", res_rev.status_code == 200 and res_rev.json().get("status") == "revoked")

        res_rev_msg = await client.post("/chatbot/message", json={
            "session_id": session_rev,
            "message": "Consulta tras revocar",
            "context": "formulario"
        })
        assert_test("CB-05: Mensajes posteriores a la revocación son denegados (403)", res_rev_msg.status_code == 403)

        # ── CB-11: Detección de urgencias vitales ─────────────────
        session_urg = f"session-urg-{uuid.uuid4()}"
        await client.post("/chatbot/consent", json={
            "session_id": session_urg,
            "consent_version": "1.0",
            "granted": True,
            "context": "formulario"
        })
        res_urg = await client.post("/chatbot/message", json={
            "session_id": session_urg,
            "message": "Ayuda, tengo dolor en el pecho agudo y me desmayé",
            "context": "formulario"
        })
        data_urg = res_urg.json()
        assert_test("CB-11: Guarda de urgencia vital activada (is_emergency=true)", res_urg.status_code == 200 and data_urg.get("is_emergency") is True)
        assert_test("CB-11: Derivación inmediata a línea 123 y Urgencias", "123" in data_urg.get("response", "") and "urgencias" in data_urg.get("response", "").lower())

        # ── CB-12: Enmascaramiento de PII ─────────────────────────
        raw_text = "Mi cédula es 1070987654 y mi celular 3101234567, correo test@correo.com"
        masked, had_pii = mask_pii(raw_text)
        assert_test("CB-12: Detección de datos personales identificables", had_pii is True)
        assert_test("CB-12: Enmascaramiento de cédula de ciudadanía", "1070987654" not in masked and "[DOCUMENTO_PROTEGIDO]" in masked)
        assert_test("CB-12: Enmascaramiento de número celular", "3101234567" not in masked and "[TELEFONO_PROTEGIDO]" in masked)
        assert_test("CB-12: Enmascaramiento de correo electrónico", "test@correo.com" not in masked and "[CORREO_PROTEGIDO]" in masked)

        # ── CB-10: Límite clínico estricto (no prescripción) ─────
        session_dx = f"session-dx-{uuid.uuid4()}"
        await client.post("/chatbot/consent", json={
            "session_id": session_dx,
            "consent_version": "1.0",
            "granted": True,
            "context": "formulario"
        })
        res_dx = await client.post("/chatbot/message", json={
            "session_id": session_dx,
            "message": "¿Qué medicamento o pastilla tomo para el dolor?",
            "context": "formulario"
        })
        text_dx = res_dx.json().get("response", "").lower()
        assert_test("CB-10: Rechazo amable de prescripción y derivación médica", any(k in text_dx for k in ["no puedo", "no estoy autorizado", "médico", "seguridad"]))

        # ── CB-18: Rate Limiting ─────────────────────────────────
        session_burst = f"session-burst-{uuid.uuid4()}"
        await client.post("/chatbot/consent", json={
            "session_id": session_burst,
            "consent_version": "1.0",
            "granted": True,
            "context": "formulario"
        })
        got_429 = False
        for i in range(25):
            res_burst = await client.post("/chatbot/message", json={
                "session_id": session_burst,
                "message": f"dolor en el pecho ráfaga {i}",
                "context": "formulario"
            })
            if res_burst.status_code == 429:
                got_429 = True
                break
        assert_test("CB-18: Rate limiting activa 429 Too Many Requests ante ráfaga", got_429 is True)


        # ── CB-25: Integridad de Archivos JSON del Frontend ───────
        frontend_data = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "data")
        json_files = ["chatbot-config.json", "consent-text.json", "faq.json", "navigation.json", "ui-labels.json"]
        all_json_valid = True
        for jf in json_files:
            jpath = os.path.join(frontend_data, jf)
            if not os.path.exists(jpath):
                all_json_valid = False
                break
            try:
                with open(jpath, "r", encoding="utf-8") as f:
                    d = json.load(f)
                    if "version" not in d:
                        all_json_valid = False
            except Exception:
                all_json_valid = False
        assert_test("CB-25: Integridad y versionado de todos los archivos JSON del frontend", all_json_valid is True)

    print("=" * 60)
    print(f"RESULTADO: {passed_tests}/{total_tests} PRUEBAS EXITOSAS")
    print("=" * 60)

    if passed_tests == total_tests:
        print("TODAS LAS PRUEBAS AUTOMATIZADAS PASARON SATISFACTORIAMENTE.")
        return 0
    else:
        print("ALGUNAS PRUEBAS FALLARON.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
