import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


def utcnow():
    return datetime.now(timezone.utc)


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    consent_version: Mapped[str] = mapped_column(String(20), nullable=False)
    granted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    context: Mapped[str] = mapped_column(String(30), nullable=False)
    user_agent_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
