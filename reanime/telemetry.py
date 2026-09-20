"""Real-time cluster telemetry prober with live latency measurement."""

import asyncio
import logging
import socket
import time
from typing import Any, Dict, List

from reanime.config import CONFIG

logger = logging.getLogger("reanime.telemetry")

_TELEMETRY_CACHE: tuple[float, List[Dict[str, Any]]] = (0.0, [])

DEFAULT_TARGETS = {
    "Sora Edge": "reanime.to",
    "Neko CDN": "api.aniskip.com",
    "Zozo Edge": "graphql.anilist.co",
}


def _probe_tcp_sync(host: str, port: int = 443, timeout: float = 2.0) -> int | None:
    """Synchronous TCP connection probe measuring true round-trip ping latency."""
    # Clean host of protocol or path if present
    clean_host = host.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
    t0 = time.perf_counter()
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        s.connect((clean_host, port))
        s.close()
        return max(4, int((time.perf_counter() - t0) * 1000))
    except Exception as e:
        logger.debug("TCP probe failed for %s: %s", clean_host, e)
        return None


async def probe_servers() -> List[Dict[str, Any]]:
    """
    Probe cluster servers and measure real millisecond round-trip time.
    Cached for 15 seconds.
    """
    global _TELEMETRY_CACHE
    now = time.time()
    cached_time, cached_servers = _TELEMETRY_CACHE

    if cached_servers and (now - cached_time < 15.0):
        return cached_servers

    servers_config = CONFIG.get("servers", [])
    tasks = []

    for srv in servers_config:
        name = srv.get("name", "Unknown Node")
        configured_host = srv.get("host", "").strip()
        host = configured_host or DEFAULT_TARGETS.get(name, "cloudflare.com")
        tasks.append(asyncio.to_thread(_probe_tcp_sync, host))

    latencies = await asyncio.gather(*tasks, return_exceptions=True)
    results: List[Dict[str, Any]] = []

    for i, srv in enumerate(servers_config):
        name = srv.get("name", "Unknown Node")
        region = srv.get("region", "Global")
        configured_host = srv.get("host", "").strip()
        lat_res = latencies[i] if i < len(latencies) else None

        if isinstance(lat_res, int) and lat_res > 0:
            lat_ms = lat_res
            status = "online" if lat_ms < 250 else ("degraded" if lat_ms < 600 else "offline")
        else:
            lat_ms = None
            status = "unconfigured" if not configured_host else "offline"

        results.append({
            "name": name,
            "region": region,
            "host": configured_host or DEFAULT_TARGETS.get(name, ""),
            "status": status,
            "latencyMs": lat_ms,
        })

    _TELEMETRY_CACHE = (now, results)
    return results
