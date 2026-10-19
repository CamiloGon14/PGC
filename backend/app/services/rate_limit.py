"""rate_limit.py — Control de tasa de peticiones para el Asistente Virtual
Hospital de Ubaté
"""
import time
from collections import defaultdict
from typing import Dict, List

# Almacén en memoria: key -> lista de timestamps (segundos)
_request_history: Dict[str, List[float]] = defaultdict(list)


def check_rate_limit(key: str, max_requests: int = 15, window_seconds: int = 60) -> bool:
    """
    Verifica si una clave (session_id o ip) ha excedido el límite de solicitudes.
    Retorna True si la petición es permitida, False si excede la cuota.
    """
    now = time.time()
    cutoff = now - window_seconds

    # Limpiar timestamps antiguos
    history = _request_history[key]
    _request_history[key] = [t for t in history if t > cutoff]

    if len(_request_history[key]) >= max_requests:
        return False

    _request_history[key].append(now)
    return True


def reset_rate_limit(key: str | None = None) -> None:
    """Limpia el historial de rate limit (útil para pruebas)."""
    if key:
        _request_history.pop(key, None)
    else:
        _request_history.clear()
