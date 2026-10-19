"""pii_filter.py — Detección y enmascaramiento de datos personales y urgencias médicas
Hospital de Ubaté - Cumplimiento Ley 1581 de 2012
"""
import re
from typing import Tuple

# Patrón para correos electrónicos
EMAIL_REGEX = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b')

# Patrón para números telefónicos móviles en Colombia (ej. 3101234567, 300 123 4567)
PHONE_REGEX = re.compile(r'\b3[0-9]{2}[\s\-]?[0-9]{3}[\s\-]?[0-9]{4}\b')

# Patrón para números de cédula / documento de 6 a 10 dígitos continuos o con puntos
# Evita confundir con años corrientes (2020-2030)
DOC_REGEX = re.compile(r'\b(?!20[2-3][0-9]\b)[1-9][0-9]{0,2}(?:\.[0-9]{3}){2}\b|\b(?!20[2-3][0-9]\b)[1-9][0-9]{6,9}\b')

# Términos que denotan emergencias médicas críticas inmediatas
EMERGENCY_KEYWORDS = [
    "paro cardiaco", "paro cardíaco", "dolor en el pecho", "dolor de pecho",
    "infarto", "no respira", "no puede respirar", "dificultad para respirar",
    "asfixia", "ahogando", "ahogo severo", "inconsciente", "perdio el conocimiento",
    "perdió el conocimiento", "desmayo", "hemorragia", "sangrado profuso",
    "sangrado abundante", "convulsion", "convulsión", "convulsionando",
    "intoxicacion", "intoxicación", "envenenamiento", "derrame cerebral", "acv",
    "trombosis", "trauma craneal", "herida de bala", "herida por arma"
]


def is_medical_emergency(text: str) -> bool:
    """Detecta si el mensaje contiene palabras clave de urgencia vital inminente."""
    if not text:
        return False
    normalized = text.lower()
    return any(keyword in normalized for keyword in EMERGENCY_KEYWORDS)


def mask_pii(text: str) -> Tuple[str, bool]:
    """
    Enmascara datos personales potencialmente identificables (cédulas, teléfonos, correos)
    antes de ser transmitidos a servicios de IA o almacenados.
    Retorna (texto_enmascarado, hubo_pii_detectada).
    """
    if not text:
        return text, False

    had_pii = False
    cleaned = text

    # Enmascarar correos
    if EMAIL_REGEX.search(cleaned):
        had_pii = True
        cleaned = EMAIL_REGEX.sub("[CORREO_PROTEGIDO]", cleaned)

    # Enmascarar teléfonos móviles
    if PHONE_REGEX.search(cleaned):
        had_pii = True
        cleaned = PHONE_REGEX.sub("[TELEFONO_PROTEGIDO]", cleaned)

    # Enmascarar números de documento
    if DOC_REGEX.search(cleaned):
        had_pii = True
        cleaned = DOC_REGEX.sub("[DOCUMENTO_PROTEGIDO]", cleaned)

    return cleaned, had_pii
