"""chatbot.py — Endpoints del Asistente Virtual con IA
Hospital de Ubaté - Sistema de Gestión Hospitalaria
"""
import hashlib
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.db import get_db
from app.models.consent import ConsentRecord
from app.dependencies import require_admin
from app.models.staff import Staff
from app.core.settings import settings
from app.services.rate_limit import check_rate_limit
from app.services.pii_filter import mask_pii, is_medical_emergency
from app.services.gemini import generate_chatbot_response

router = APIRouter(prefix="/chatbot", tags=["Chatbot Asistido por IA"])


def utcnow():
    return datetime.now(timezone.utc)


def hash_string(val: Optional[str]) -> Optional[str]:
    if not val:
        return None
    return hashlib.sha256(val.encode("utf-8")).hexdigest()


# ── Schemas ──────────────────────────────────────────────

class ConsentRequest(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=64)
    consent_version: str = Field("1.0", max_length=20)
    granted: bool
    context: str = Field("formulario", max_length=30)
    user_agent: Optional[str] = None


class RevokeConsentRequest(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=64)


class ChatMessageRequest(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=64)
    message: str = Field(..., min_length=1, max_length=500)
    context: str = Field("formulario", max_length=30)


class ChatMessageResponse(BaseModel):
    response: str
    is_emergency: bool = False
    had_pii: bool = False
    disclaimer: str


class ConsentAuditItem(BaseModel):
    id: str
    session_id: str
    consent_version: str
    granted: bool
    granted_at: datetime
    revoked_at: Optional[datetime]
    context: str
    created_at: datetime


# ── Endpoints ────────────────────────────────────────────

@router.get("/config")
async def get_chatbot_config():
    """Retorna la configuración pública y versión activa del consentimiento."""
    return {
        "status": "ok",
        "consent_version": "1.0",
        "assistant_name": "Asistente Virtual Hospital de Ubaté",
        "max_length": 500,
        "rate_limit_per_minute": settings.chatbot_rate_limit,
        "contacts": {
            "emergency": "123",
            "hospital_switchboard": "(601) 855 2222",
            "hospital_urgencias": "(601) 855 3300",
            "habeas_data_email": "protecciondatos@hospitalubate.gov.co"
        }
    }


@router.post("/consent", status_code=status.HTTP_201_CREATED)
async def register_consent(
    req: ConsentRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Registra la decisión de autorización o rechazo de tratamiento de datos personales
    (Habeas Data - Ley 1581 de 2012 y Decreto 1377 de 2013).
    """
    client_ip = request.client.host if request.client else None
    ip_hash = hash_string(client_ip)
    ua_hash = hash_string(req.user_agent or request.headers.get("user-agent"))

    record = ConsentRecord(
        session_id=req.session_id,
        consent_version=req.consent_version,
        granted=req.granted,
        granted_at=utcnow(),
        revoked_at=None,
        context=req.context,
        user_agent_hash=ua_hash,
        ip_hash=ip_hash
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return {
        "status": "ok",
        "id": record.id,
        "session_id": record.session_id,
        "granted": record.granted,
        "consent_version": record.consent_version,
        "granted_at": record.granted_at.isoformat()
    }


@router.post("/consent/revoke")
async def revoke_consent(
    req: RevokeConsentRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Revoca la autorización de tratamiento de datos personales previamente concedida.
    Deshabilita inmediatamente el acceso al chat para dicha sesión.
    """
    query = (
        select(ConsentRecord)
        .where(ConsentRecord.session_id == req.session_id)
        .where(ConsentRecord.granted == True)
        .where(ConsentRecord.revoked_at.is_(None))
        .order_by(desc(ConsentRecord.granted_at))
    )
    result = await db.execute(query)
    record = result.scalars().first()

    if not record:
        return {"status": "already_revoked_or_not_found", "session_id": req.session_id}

    record.revoked_at = utcnow()
    await db.commit()

    return {
        "status": "revoked",
        "session_id": req.session_id,
        "revoked_at": record.revoked_at.isoformat()
    }


@router.post("/message", response_model=ChatMessageResponse)
async def send_chatbot_message(
    req: ChatMessageRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Envía un mensaje al asistente virtual tras verificar consentimiento y tasa de peticiones.
    No almacena el contenido del mensaje de la conversación para cumplir con minimización de datos.
    """
    # 1. Rate Limiting por sesión e IP
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{req.session_id}:{client_ip}"
    if not check_rate_limit(rate_key, max_requests=settings.chatbot_rate_limit, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Has superado el límite de consultas por minuto. Por favor espera unos momentos antes de intentar nuevamente."
        )

    # 2. Verificación de Consentimiento Activo (Ley 1581)
    consent_query = (
        select(ConsentRecord)
        .where(ConsentRecord.session_id == req.session_id)
        .where(ConsentRecord.granted == True)
        .where(ConsentRecord.revoked_at.is_(None))
        .order_by(desc(ConsentRecord.granted_at))
    )
    result = await db.execute(consent_query)
    active_consent = result.scalars().first()

    if not active_consent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No se encontró una autorización de tratamiento de datos activa para esta sesión. Debe autorizar el tratamiento para interactuar con el asistente."
        )

    # 3. Detección inmediata de urgencia vital
    if is_medical_emergency(req.message):
        return ChatMessageResponse(
            response=(
                "⚠️ ALERTA DE URGENCIAS: Has mencionado síntomas de gravedad potencial. "
                "Esta situación puede requerir atención médica inmediata. Por favor dirígete sin demora a la sala de "
                "urgencias del Hospital de Ubaté o comunícate de inmediato con la línea 123."
            ),
            is_emergency=True,
            had_pii=False,
            disclaimer="Aviso de urgencia inmediata generado automáticamente."
        )

    # 4. Filtro y enmascaramiento de PII
    masked_text, had_pii = mask_pii(req.message)

    # 5. Generación de respuesta con Gemini (o fallback seguro institucional)
    bot_reply = await generate_chatbot_response(masked_text, req.context)

    return ChatMessageResponse(
        response=bot_reply,
        is_emergency=False,
        had_pii=had_pii,
        disclaimer="Respuesta generada por Inteligencia Artificial orientativa. No constituye consejo médico ni diagnóstico."
    )


@router.get("/staff/audit", response_model=List[ConsentAuditItem])
async def list_consent_audit(
    limit: int = 50,
    current_user: Staff = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Consulta de auditoría de registros de consentimiento otorgados o revocados.
    Exclusivo para administradores y oficial de protección de datos.
    """
    query = (
        select(ConsentRecord)
        .order_by(desc(ConsentRecord.created_at))
        .limit(min(limit, 100))
    )
    result = await db.execute(query)
    records = result.scalars().all()

    return [
        ConsentAuditItem(
            id=r.id,
            session_id=r.session_id,
            consent_version=r.consent_version,
            granted=r.granted,
            granted_at=r.granted_at,
            revoked_at=r.revoked_at,
            context=r.context,
            created_at=r.created_at
        )
        for r in records
    ]
