"""Pluggable stream resolver module with built-in Node.js WASM token decryption bridge."""

import asyncio
import json
import logging
from pathlib import Path
import shutil
import subprocess
import time
from typing import Any, Dict, List, Optional

import httpx

from reanime import anilist, shield
from reanime.aniskip import get_skip_times
from reanime.config import CONFIG

logger = logging.getLogger("reanime.resolver")

BASE_DIR = Path(__file__).resolve().parent.parent
NODE_RESOLVER_SCRIPT = BASE_DIR / "node" / "resolve.js"

REANIME_BASE = "https://reanime.to"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": f"{REANIME_BASE}/",
}


class ResolverError(Exception):
    """Custom exception raised when stream resolution fails or is not configured."""
    pass


# In-memory stream cache: (slug_or_id, episode, lang) -> (timestamp, data)
_STREAM_CACHE: Dict[tuple[str, int, str], tuple[float, Dict[str, Any]]] = {}


def _run_node_resolver_sync(html_bytes: bytes) -> Dict[str, Any]:
    """Synchronously execute node/resolve.js with timeout and parse output."""
    if not NODE_RESOLVER_SCRIPT.exists():
        raise ResolverError(f"Resolver script not found at {NODE_RESOLVER_SCRIPT}")

    node_bin = shutil.which("node") or "node"
    try:
        proc = subprocess.run(
            [node_bin, str(NODE_RESOLVER_SCRIPT), "-"],
            input=html_bytes,
            capture_output=True,
            timeout=25.0,
        )
    except subprocess.TimeoutExpired:
        raise ResolverError("WASM decryption subprocess timed out")
    except Exception as e:
        logger.exception("Failed to run node resolver subprocess: %s", e)
        raise ResolverError(f"Failed to run node resolver: {str(e)}")

    if proc.returncode != 0:
        err_msg = proc.stderr.decode("utf-8", errors="replace").strip()
        logger.error("Node resolver exited with code %d: %s", proc.returncode, err_msg)
        raise ResolverError(f"CDN token resolution error: {err_msg[:200]}")

    try:
        return json.loads(proc.stdout.decode("utf-8"))
    except json.JSONDecodeError as e:
        logger.error("Failed to parse resolver JSON output: %s", e)
        raise ResolverError("Invalid JSON from CDN resolver")


async def decrypt_embed_html(html_bytes: bytes) -> Dict[str, Any]:
    """Execute node/resolve.js in thread to unpack WASM and decrypt AES-256-CBC token payload."""
    return await asyncio.to_thread(_run_node_resolver_sync, html_bytes)


def normalize_upstream_response(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize raw upstream data into standardized {sources, subtitles, skip} structure.
    Adds three failover sources in priority order: HD-2 (1) -> HD-1 (2) -> SD-1 (3).
    """
    raw_sources = data.get("sources") or []
    if not raw_sources and data.get("url"):
        raw_sources = [{"server": "HD-2", "url": data["url"], "type": "hls"}]

    if not raw_sources:
        raise ResolverError("Upstream returned no stream sources")

    tier_names = ["HD-2", "HD-1", "SD-1"]
    normalized_sources: List[Dict[str, Any]] = []

    for i, s in enumerate(raw_sources[:3]):
        server_name = s.get("server") or tier_names[min(i, len(tier_names) - 1)]
        url = s.get("url", "")
        if not url:
            continue
        priority = s.get("priority", i + 1)
        normalized_sources.append({
            "server": server_name,
            "url": url,
            "embed": s.get("embed", ""),
            "type": s.get("type", "hls"),
            "priority": priority,
            "signed": shield.sign(url),
        })

    # Generate failover mirrors if fewer than 3 sources
    if len(normalized_sources) == 1 and normalized_sources[0]["url"]:
        primary_url = normalized_sources[0]["url"]
        primary_embed = normalized_sources[0].get("embed", "")
        for idx, s_name in enumerate(["HD-1", "SD-1"], start=2):
            normalized_sources.append({
                "server": s_name,
                "url": primary_url,
                "embed": primary_embed,
                "type": "hls",
                "priority": idx,
                "signed": shield.sign(primary_url),
            })
    elif len(normalized_sources) == 2 and normalized_sources[0]["url"]:
        normalized_sources.append({
            "server": "SD-1",
            "url": normalized_sources[1]["url"],
            "embed": normalized_sources[1].get("embed", ""),
            "type": "hls",
            "priority": 3,
            "signed": shield.sign(normalized_sources[1]["url"]),
        })

    normalized_sources.sort(key=lambda x: x["priority"])

    raw_subs = data.get("subtitles") or []
    normalized_subs: List[Dict[str, Any]] = []
    for sub in raw_subs:
        normalized_subs.append({
            "lang": sub.get("lang") or sub.get("language", "en")[:2].lower(),
            "label": sub.get("label") or sub.get("language", "English"),
            "url": sub.get("url", ""),
            "default": bool(sub.get("default", False)),
        })

    skip = data.get("skip") or {}
    return {
        "sources": normalized_sources,
        "subtitles": normalized_subs,
        "skip": skip,
    }


async def _resolve_via_builtin(slug_or_id: str, episode: int, lang: str = "sub", mal_id: Optional[int] = None) -> Dict[str, Any]:
    """Resolve stream using local ReAnime/FlixCloud WASM decryption bridge."""
    aid = None
    if str(slug_or_id).isdigit():
        aid = int(slug_or_id)
    else:
        # Try decoding base36 from slug
        aid = anilist.decode_slug(slug_or_id)
        if not aid or aid > 20000000:  # If too high or not a real AniList ID
            # Search AniList for the real ID
            clean_q = slug_or_id.rsplit("-", 1)[0].replace("-", " ")
            try:
                search_res = await anilist.search_anime(q=clean_q, per_page=1)
                items = search_res.get("results") or []
                if items:
                    aid = items[0]["anilistId"]
            except Exception as e:
                logger.warning("AniList search lookup failed: %s", e)

    if not aid:
        raise ResolverError(f"Could not determine AniList ID for {slug_or_id}")

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Fetch playback servers
        flix_url = f"{REANIME_BASE}/api/flix/{aid}/{episode}"
        try:
            resp = await client.get(flix_url, headers=HEADERS)
        except Exception as e:
            raise ResolverError(f"Failed to query flix servers: {e}")

        if resp.status_code != 200:
            raise ResolverError(f"Flix query returned HTTP {resp.status_code}")

        flix_data = resp.json()
        servers = flix_data.get("servers") or []
        if not servers:
            raise ResolverError(f"No playback servers found for ID {aid} episode {episode}")

        # Filter by sub/dub
        target_servers = [s for s in servers if lang in s.get("dataType", "")]
        if not target_servers:
            target_servers = servers

        chosen_server = target_servers[0]
        data_link = chosen_server.get("dataLink")
        if not data_link:
            raise ResolverError("Server has no embed link")

        # 2. Fetch embed HTML and query AniSkip in parallel
        skip_task = get_skip_times(mal_id or aid, episode) if aid else None
        embed_task = client.get(data_link, headers=HEADERS)

        if skip_task:
            embed_resp, skip_data = await asyncio.gather(embed_task, skip_task, return_exceptions=True)
            if isinstance(skip_data, Exception):
                skip_data = {}
        else:
            embed_resp = await embed_task
            skip_data = {}

        if isinstance(embed_resp, Exception) or embed_resp.status_code != 200:
            raise ResolverError(f"Failed to fetch embed page from {data_link}")

        # 3. Decrypt token using Node WASM bridge
        decrypted = await decrypt_embed_html(embed_resp.content)
        decrypted["embed"] = data_link

        normalized = normalize_upstream_response(decrypted)

        # Attach matching server embed links to each source
        for src in normalized.get("sources", []):
            srv_name = src.get("server")
            matched = next((ts for ts in target_servers if ts.get("serverName") == srv_name and ts.get("dataLink")), None)
            if matched:
                src["embed"] = matched["dataLink"]
            elif not src.get("embed"):
                src["embed"] = data_link

        if skip_data:
            normalized["skip"] = skip_data

        return normalized


async def resolve(slug_or_id: str, episode: int, lang: str = "sub", mal_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Pluggable resolver entrypoint.
    If RESOLVER_BASE is set, routes to external microservice.
    Otherwise, uses the built-in Node.js WASM resolver bridge.
    """
    resolver_base = CONFIG.get("resolver_base", "").strip()

    if not resolver_base:
        if CONFIG.get("disable_builtin"):
            raise ResolverError("resolver not configured")
        return await _resolve_via_builtin(slug_or_id, episode, lang, mal_id)

    cache_key = (str(slug_or_id), int(episode), str(lang))
    now = time.time()
    stream_ttl = CONFIG.get("cache", {}).get("stream_ttl", 120)

    if cache_key in _STREAM_CACHE:
        c_time, c_data = _STREAM_CACHE[cache_key]
        if now - c_time < stream_ttl:
            return c_data

    headers = {"Accept": "application/json"}
    resolver_key = CONFIG.get("resolver_key", "").strip()
    if resolver_key:
        headers["Authorization"] = f"Bearer {resolver_key}"

    target_url = f"{resolver_base.rstrip('/')}/resolve"
    params = {"id": slug_or_id, "episode": episode, "lang": lang}

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            tasks = [client.get(target_url, params=params, headers=headers)]
            if mal_id:
                tasks.append(get_skip_times(mal_id, episode))

            responses = await asyncio.gather(*tasks, return_exceptions=True)
            upstream_resp = responses[0]
            skip_data = responses[1] if len(responses) > 1 and isinstance(responses[1], dict) else {}

            if isinstance(upstream_resp, Exception):
                logger.error("Upstream resolver request failed: %s", upstream_resp)
                raise ResolverError(f"Upstream resolver unreachable: {str(upstream_resp)}")

            if upstream_resp.status_code != 200:
                logger.error("Upstream resolver status %d: %s", upstream_resp.status_code, upstream_resp.text[:200])
                raise ResolverError(f"Upstream returned HTTP {upstream_resp.status_code}")

            data = upstream_resp.json()
        except Exception as e:
            if isinstance(e, ResolverError):
                raise
            logger.error("Resolver execution error: %s", e)
            raise ResolverError(str(e))

    normalized = normalize_upstream_response(data)
    if skip_data and not normalized.get("skip"):
        normalized["skip"] = skip_data

    _STREAM_CACHE[cache_key] = (now, normalized)
    return normalized
