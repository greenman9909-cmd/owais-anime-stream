"""HMAC URL signing and validation for origin shielding."""

import hashlib
import hmac
import time
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from reanime.config import CONFIG


def _get_secret() -> bytes:
    secret = CONFIG.get("shield_secret", "change-me")
    return secret.encode("utf-8")


def _strip_shield_params(url: str) -> tuple[str, str | None, str | None]:
    """Strip t and e parameters from URL query string and return (clean_url, t, e)."""
    parsed = urlparse(url)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    t = qs.pop("t", [None])[0]
    e = qs.pop("e", [None])[0]
    
    clean_query = urlencode([(k, v) for k, vs in qs.items() for v in vs])
    clean_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        clean_query,
        parsed.fragment,
    ))
    return clean_url, t, e


def sign(url: str, ttl_seconds: int = 3600) -> str:
    """Returns url with ?t=<hex>&e=<unix_expiry> (or appended &t=...&e=...)."""
    clean_url, _, _ = _strip_shield_params(url)
    expiry = int(time.time()) + ttl_seconds
    msg = f"{clean_url}|{expiry}".encode("utf-8")
    token = hmac.new(_get_secret(), msg, hashlib.sha256).hexdigest()

    parsed = urlparse(clean_url)
    sep = "&" if parsed.query else "?"
    return f"{clean_url}{sep}t={token}&e={expiry}"


def verify(url: str, t: str, e: str) -> bool:
    """Returns True if token is valid and not expired."""
    if not t or not e:
        return False

    try:
        expiry = int(e)
    except (ValueError, TypeError):
        return False

    if time.time() > expiry:
        return False

    clean_url, _, _ = _strip_shield_params(url)
    msg = f"{clean_url}|{expiry}".encode("utf-8")
    expected = hmac.new(_get_secret(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(t, expected)


def validate_request(url: str) -> bool:
    """Extracts t and e from the query string and calls verify."""
    clean_url, t, e = _strip_shield_params(url)
    if not t or not e:
        return False
    return verify(clean_url, t, e)
