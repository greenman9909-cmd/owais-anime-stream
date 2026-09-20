"""ReAnime.to catalog data retrieval and normalization layer."""

import asyncio
import logging
import re
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException

logger = logging.getLogger("reanime.catalog")

BASE = "https://reanime.to"
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
DEFAULT_HEADERS = {
    "User-Agent": _UA,
    "Accept": "application/json, */*",
    "Referer": f"{BASE}/",
}


async def _get(
    client: httpx.AsyncClient,
    path: str,
    params: Optional[Dict[str, Any]] = None,
    base: str = BASE,
) -> Any:
    """Helper to perform GET requests with error handling."""
    url = f"{base}{path}"
    try:
        r = await client.get(url, params=params)
    except Exception as e:
        logger.error("HTTP error request to %s: %s", url, e)
        raise HTTPException(status_code=502, detail=f"Upstream network failure: {str(e)}")

    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="Resource not found upstream")
    if not r.is_success:
        raise HTTPException(status_code=r.status_code, detail=r.text[:300])

    content_type = r.headers.get("content-type", "")
    if "application/json" in content_type:
        return r.json()
    try:
        return r.json()
    except Exception:
        return r.text


def extract_anilist_id(anime: Dict[str, Any]) -> Optional[int]:
    """Extract AniList numeric ID from anime metadata or cover URL."""
    if not anime:
        return None
    if anime.get("anilist_id"):
        try:
            return int(anime["anilist_id"])
        except (ValueError, TypeError):
            pass
    if anime.get("anilist"):
        try:
            return int(anime["anilist"])
        except (ValueError, TypeError):
            pass
    for key in ("extra_large", "large", "medium"):
        url = (anime.get("cover_image") or {}).get(key, "")
        m = re.search(r"/bx(\d+)-", url)
        if m:
            return int(m.group(1))
    return None


async def search_anime(
    client: httpx.AsyncClient,
    q: str,
    limit: int = 20,
    offset: int = 0,
) -> Dict[str, Any]:
    """Search anime catalog by query string."""
    try:
        # Modern v1 API endpoint
        return await _get(client, "/api/v1/search", {"q": q, "limit": limit, "offset": offset})
    except HTTPException as e:
        if e.status_code == 404:
            # Fallback to legacy endpoint
            return await _get(client, "/api/search", {"q": q, "limit": limit, "offset": offset})
        raise


async def get_home(
    client: httpx.AsyncClient,
    limit: int = 20,
) -> Dict[str, Any]:
    """Fetch latest aired and top weekly releases."""
    async def _fetch_latest():
        try:
            return await _get(client, "/api/v1/home/latest-aired", {"limit": limit})
        except HTTPException:
            return await _get(client, "/api/home/latest-aired", {"limit": limit})

    async def _fetch_top():
        try:
            return await _get(client, "/api/v1/top/anime", {"period": "week", "limit": limit})
        except HTTPException:
            return await _get(client, "/api/top/anime", {"period": "week", "limit": limit})

    latest, top = await asyncio.gather(_fetch_latest(), _fetch_top(), return_exceptions=True)
    latest_data = latest if not isinstance(latest, Exception) else {"data": []}
    top_data = top if not isinstance(top, Exception) else {"data": []}

    return {"latest_aired": latest_data, "top_weekly": top_data}


async def get_top(
    client: httpx.AsyncClient,
    period: str = "week",
    limit: int = 20,
) -> Dict[str, Any]:
    """Fetch top anime for given period (day, week, or month)."""
    try:
        return await _get(client, "/api/v1/top/anime", {"period": period, "limit": limit})
    except HTTPException:
        return await _get(client, "/api/top/anime", {"period": period, "limit": limit})


async def get_schedule(client: httpx.AsyncClient) -> Dict[str, Any]:
    """Fetch weekly anime release schedule."""
    try:
        return await _get(client, "/api/v1/schedule")
    except HTTPException:
        return await _get(client, "/api/schedule")


async def get_anime_info(
    client: httpx.AsyncClient,
    slug: str,
) -> Dict[str, Any]:
    """Fetch complete anime details along with episode listings."""
    anime_meta: Dict[str, Any] = {}
    episodes_data: Any = []

    try:
        anime_meta = await _get(client, f"/api/v1/anime/{slug}")
    except HTTPException:
        try:
            watch = await _get(client, f"/api/watch/{slug}/1")
            anime_meta = watch.get("anime") or {}
        except HTTPException:
            pass

    try:
        episodes_resp = await _get(client, f"/api/v1/anime/{slug}/episodes")
        episodes_data = (
            episodes_resp.get("data", [])
            if isinstance(episodes_resp, dict)
            else episodes_resp
        )
    except HTTPException:
        try:
            eps = await _get(client, f"/api/episodes/{slug}")
            episodes_data = eps if isinstance(eps, list) else eps.get("data", eps.get("episodes", []))
        except HTTPException:
            pass

    anilist_id = extract_anilist_id(anime_meta)
    return {
        **anime_meta,
        "episodes": episodes_data,
        "anilist_id": anilist_id,
    }


async def get_episodes(
    client: httpx.AsyncClient,
    slug: str,
) -> List[Dict[str, Any]]:
    """Fetch episode listing for a specific anime slug."""
    try:
        resp = await _get(client, f"/api/v1/anime/{slug}/episodes")
        return resp.get("data", []) if isinstance(resp, dict) else resp
    except HTTPException:
        data = await _get(client, f"/api/episodes/{slug}")
        return data if isinstance(data, list) else data.get("data", data.get("episodes", data))


async def get_servers(
    client: httpx.AsyncClient,
    slug: str,
    episode: int,
    anilist_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Fetch and organize playback servers for an episode."""
    anime_meta: Dict[str, Any] = {}
    aid = anilist_id

    if not aid:
        try:
            anime_meta = await _get(client, f"/api/v1/anime/{slug}")
            aid = extract_anilist_id(anime_meta)
        except HTTPException:
            try:
                watch = await _get(client, f"/api/watch/{slug}/{episode}")
                anime_meta = watch.get("anime") or {}
                aid = extract_anilist_id(anime_meta)
            except HTTPException:
                pass

    flix_servers: List[Dict[str, Any]] = []
    if aid:
        try:
            flix_resp = await _get(client, f"/api/flix/{aid}/{episode}")
            if isinstance(flix_resp, dict) and flix_resp.get("success"):
                flix_servers = flix_resp.get("servers", [])
        except HTTPException:
            pass

    # Sort HD-2 first, HD-1 second
    order_map = {"HD-2": 0, "HD-1": 1}

    def sort_servers(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return sorted(items, key=lambda s: order_map.get(s.get("serverName", ""), 9))

    sub_servers = sort_servers(
        [s for s in flix_servers if s.get("dataType") in ("sub", "s-sub")]
    )
    dub_servers = sort_servers(
        [s for s in flix_servers if s.get("dataType") in ("dub", "s-dub")]
    )

    return {
        "sub": sub_servers,
        "dub": dub_servers,
        "anilist_id": aid,
        "anime": anime_meta,
        "intro_start": anime_meta.get("intro_start", 90),
        "intro_end": anime_meta.get("intro_end", 180),
        "outro_start": anime_meta.get("outro_start"),
        "outro_end": anime_meta.get("outro_end"),
        "current": episode,
        "duration": anime_meta.get("duration"),
    }


async def get_thumbnails(
    client: httpx.AsyncClient,
    anilist_id: int,
) -> Dict[str, Any]:
    """Fetch thumbnail data for an anime by AniList ID."""
    return await _get(client, f"/api/thumbnails/{anilist_id}")


async def get_recommendations(
    client: httpx.AsyncClient,
    slug: str,
) -> Dict[str, Any]:
    """Fetch related recommendations for an anime slug."""
    try:
        return await _get(client, f"/api/v1/anime/{slug}/recommendations")
    except HTTPException:
        return await _get(client, f"/api/anime/{slug}/recommendations")
