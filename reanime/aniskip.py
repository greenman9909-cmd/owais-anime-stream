"""AniSkip API client for anime intro and outro skip markers."""

import logging
import time
from typing import Any, Dict

import httpx

from reanime.config import CONFIG

logger = logging.getLogger("reanime.aniskip")

# In-memory cache: (mal_id, episode) -> (timestamp, data)
_SKIP_CACHE: Dict[tuple[int, int], tuple[float, Dict[str, Any]]] = {}


async def get_skip_times(mal_id: int, episode: int, episode_length: int = 0) -> Dict[str, Any]:
    """
    Fetch skip times for an episode from AniSkip API.
    Returns {"intro": {"start": float, "end": float}, "outro": {...}} or {} if none.
    """
    if not mal_id or episode is None:
        return {}

    cache_key = (int(mal_id), int(episode))
    now = time.time()
    ttl = CONFIG.get("cache", {}).get("skip_ttl", 86400)

    if cache_key in _SKIP_CACHE:
        cached_time, cached_val = _SKIP_CACHE[cache_key]
        if now - cached_time < ttl:
            return cached_val

    base_url = CONFIG.get("aniskip_url", "https://api.aniskip.com/v2")
    url = f"{base_url}/skip-times/{mal_id}/{episode}"
    params = [
        ("types[]", "op"),
        ("types[]", "ed"),
        ("episodeLength", str(episode_length)),
    ]

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return {}
            data = resp.json()
    except Exception as e:
        logger.debug("AniSkip API query failed silently: %s", e)
        return {}

    if not data or not data.get("found"):
        _SKIP_CACHE[cache_key] = (now, {})
        return {}

    results = data.get("results", [])
    skip_data: Dict[str, Any] = {}

    for res in results:
        skip_type = res.get("skipType")
        interval = res.get("interval") or {}
        start_time = interval.get("startTime")
        end_time = interval.get("endTime")

        if start_time is not None and end_time is not None:
            marker = {
                "start": float(start_time),
                "end": float(end_time),
            }
            if skip_type == "op":
                skip_data["intro"] = marker
            elif skip_type == "ed":
                skip_data["outro"] = marker

    _SKIP_CACHE[cache_key] = (now, skip_data)
    return skip_data
