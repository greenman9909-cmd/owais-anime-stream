"""AniList GraphQL client and slug generator."""

import logging
import re
import time
from typing import Any, Dict, List, Optional

import httpx

from reanime.config import CONFIG

logger = logging.getLogger("reanime.anilist")

# In-memory caches: key -> (timestamp, data)
_CATALOG_CACHE: Dict[str, tuple[float, Any]] = {}


def to_base36(num: int) -> str:
    """Encode an integer to a base36 string."""
    alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
    if num == 0:
        return "0"
    arr = []
    n = abs(num)
    while n > 0:
        arr.append(alphabet[n % 36])
        n //= 36
    return "".join(reversed(arr))


def from_base36(s: str) -> Optional[int]:
    """Decode a base36 string to an integer."""
    try:
        return int(s.lower(), 36)
    except (ValueError, TypeError):
        return None


def slugify(text: str) -> str:
    """Generate a clean URL slug from title string."""
    text = (text or "").lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text).strip("-")
    return text or "anime"


def build_slug(romaji: str, anilist_id: int) -> str:
    """Derive slug: slugify(title.romaji) + '-' + base36(anilistId)."""
    clean_title = slugify(romaji)
    b36 = to_base36(anilist_id)
    return f"{clean_title}-{b36}"


def decode_slug(slug_or_id: str) -> Optional[int]:
    """Decode anilist ID from slug suffix or direct numerical ID."""
    if not slug_or_id:
        return None
    s = str(slug_or_id).strip()
    if s.isdigit():
        return int(s)

    parts = s.split("-")
    last = parts[-1]
    decoded = from_base36(last)
    if decoded is not None and decoded > 0:
        return decoded
    return None


SEARCH_QUERY = """
query ($q: String, $page: Int, $perPage: Int, $genre: String, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
      currentPage
    }
    media(search: $q, genre: $genre, type: ANIME, sort: $sort, isAdult: false) {
      id
      idMal
      title {
        romaji
        english
        native
      }
      coverImage {
        large
        extraLarge
      }
      bannerImage
      format
      episodes
      status
      seasonYear
      averageScore
      genres
    }
  }
}
"""

ANIME_DETAIL_QUERY = """
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    idMal
    title {
      romaji
      english
      native
    }
    coverImage {
      large
      extraLarge
    }
    bannerImage
    description(asHtml: false)
    episodes
    status
    seasonYear
    averageScore
    genres
    nextAiringEpisode {
      episode
    }
    streamingEpisodes {
      title
      thumbnail
      url
      site
    }
  }
}
"""


async def execute_graphql(query: str, variables: Dict[str, Any]) -> Dict[str, Any]:
    """Execute query against AniList GraphQL endpoint."""
    url = CONFIG.get("anilist_url", "https://graphql.anilist.co")
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            url,
            json={"query": query, "variables": variables},
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        if resp.status_code != 200:
            logger.error("AniList GraphQL HTTP %d: %s", resp.status_code, resp.text[:200])
            raise RuntimeError(f"AniList query failed with status {resp.status_code}")
        data = resp.json()
        if "errors" in data:
            logger.error("AniList GraphQL errors: %s", data["errors"])
            raise RuntimeError(str(data["errors"]))
        return data.get("data", {})


def _format_media_item(m: Dict[str, Any]) -> Dict[str, Any]:
    anilist_id = m.get("id")
    mal_id = m.get("idMal") or anilist_id
    title_obj = m.get("title") or {}
    romaji = title_obj.get("romaji") or title_obj.get("english") or "Unknown"
    slug = build_slug(romaji, anilist_id)

    cover_obj = m.get("coverImage") or {}
    cover = cover_obj.get("extraLarge") or cover_obj.get("large") or ""
    banner = m.get("bannerImage") or cover

    return {
        "slug": slug,
        "anilistId": anilist_id,
        "malId": mal_id,
        "title": {
            "romaji": romaji,
            "english": title_obj.get("english") or romaji,
            "native": title_obj.get("native") or "",
        },
        "cover": cover,
        "banner": banner,
        "format": m.get("format") or "TV",
        "episodes": m.get("episodes") or 12,
        "status": m.get("status") or "FINISHED",
        "year": m.get("seasonYear") or 2024,
        "score": m.get("averageScore") or 80,
        "genres": m.get("genres") or ["Action"],
    }


async def search_anime(
    q: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    genre: Optional[str] = None,
    sort: Optional[str] = None,
) -> Dict[str, Any]:
    """Search AniList catalog with optional genre or sort filters."""
    cache_key = f"search:{q}:{page}:{per_page}:{genre}:{sort}"
    now = time.time()
    ttl = CONFIG.get("cache", {}).get("catalog_ttl", 3600)

    if cache_key in _CATALOG_CACHE:
        c_time, c_val = _CATALOG_CACHE[cache_key]
        if now - c_time < ttl:
            return c_val

    sort_list = ["POPULARITY_DESC"]
    if sort == "trending":
        sort_list = ["TRENDING_DESC"]
    elif sort == "score":
        sort_list = ["SCORE_DESC"]
    elif not q:
        sort_list = ["TRENDING_DESC", "POPULARITY_DESC"]

    variables = {
        "q": q if q else None,
        "page": page,
        "perPage": per_page,
        "genre": genre if genre else None,
        "sort": sort_list,
    }

    data = await execute_graphql(SEARCH_QUERY, variables)
    page_data = data.get("Page") or {}
    page_info = page_data.get("pageInfo") or {}
    media_list = page_data.get("media") or []

    results = [_format_media_item(m) for m in media_list]
    payload = {
        "page": page_info.get("currentPage", page),
        "hasNext": page_info.get("hasNextPage", False),
        "results": results,
    }

    _CATALOG_CACHE[cache_key] = (now, payload)
    return payload


async def get_anime_by_id(anilist_id: int) -> Optional[Dict[str, Any]]:
    """Fetch complete anime details by AniList ID."""
    cache_key = f"anime:{anilist_id}"
    now = time.time()
    ttl = CONFIG.get("cache", {}).get("catalog_ttl", 3600)

    if cache_key in _CATALOG_CACHE:
        c_time, c_val = _CATALOG_CACHE[cache_key]
        if now - c_time < ttl:
            return c_val

    data = await execute_graphql(ANIME_DETAIL_QUERY, {"id": anilist_id})
    media = data.get("Media")
    if not media:
        return None

    formatted = _format_media_item(media)
    formatted["synopsis"] = media.get("description") or "No synopsis available."

    streaming_eps = media.get("streamingEpisodes") or []
    episode_list = []
    if streaming_eps:
        for idx, ep in enumerate(streaming_eps):
            title = ep.get("title") or f"Episode {idx + 1}"
            # Extract number if possible
            num_match = re.search(r"Episode\s+(\d+)", title, re.IGNORECASE)
            ep_num = int(num_match.group(1)) if num_match else idx + 1
            episode_list.append({
                "number": ep_num,
                "title": title,
                "aired": "",
                "thumbnail": ep.get("thumbnail") or formatted["banner"],
            })
    else:
        total_eps = formatted.get("episodes") or 12
        for ep_num in range(1, total_eps + 1):
            episode_list.append({
                "number": ep_num,
                "title": f"Episode {ep_num}",
                "aired": "",
                "thumbnail": formatted["banner"],
            })

    formatted["episodeList"] = episode_list
    _CATALOG_CACHE[cache_key] = (now, formatted)
    return formatted
