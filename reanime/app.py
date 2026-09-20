"""FastAPI application for AnimeXOsource_Owais web platform and embed player."""

import logging
import time
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, Header, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from reanime import anilist, shield
from reanime.config import CONFIG
from reanime.resolver import ResolverError, resolve
from reanime.telemetry import probe_servers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("reanime.app")

BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"
START_TIME = time.time()

app = FastAPI(
    title="AnimeXOsource_Owais",
    description="Clean, high-speed anime embeds and streaming infrastructure.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Static files mount
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# CORS configuration - Allow all origins for /embed/* and /api/*
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------
# JSON Error Handler (Never return HTML error pages)
# --------------------------------------------------------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # If detail is already a dict, unpack it
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": str(exc.detail), "detail": str(exc.detail)},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": "validation error", "detail": str(exc.errors())},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"error": "internal server error", "detail": str(exc)},
    )


# --------------------------------------------------------------------------
# Studio & Embed Web Routes
# --------------------------------------------------------------------------
@app.get("/", tags=["Studio"])
async def serve_studio(authorization: Optional[str] = Header(None)):
    """Studio Console landing page. Protected by STUDIO_TOKEN if configured."""
    studio_token = CONFIG.get("studio_token", "").strip()
    if studio_token:
        expected = f"Bearer {studio_token}"
        if not authorization or authorization.strip() != expected:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "unauthorized", "detail": "Valid Studio Bearer token required."},
            )

    index_file = TEMPLATES_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Studio template not found")
    return FileResponse(str(index_file))


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Return site favicon for browser root requests."""
    fav_file = STATIC_DIR / "favicon.svg"
    if fav_file.exists():
        return FileResponse(str(fav_file), media_type="image/svg+xml")
    raise HTTPException(status_code=404, detail="Favicon not found")


@app.get("/embed/ani/{anilist_id}/{ep}", tags=["Embed Player"])
async def embed_by_ani(anilist_id: int, ep: int):
    """Embed player route resolving slug from AniList ID."""
    embed_file = TEMPLATES_DIR / "embed.html"
    if not embed_file.exists():
        raise HTTPException(status_code=404, detail="Embed template not found")
    return FileResponse(str(embed_file))


@app.get("/embed/mal/{mal_id}/{ep}", tags=["Embed Player"])
async def embed_by_mal(mal_id: int, ep: int):
    """Embed player route resolving slug from MyAnimeList ID."""
    embed_file = TEMPLATES_DIR / "embed.html"
    if not embed_file.exists():
        raise HTTPException(status_code=404, detail="Embed template not found")
    return FileResponse(str(embed_file))


@app.get("/embed/{slug}/{ep}", tags=["Embed Player"])
async def embed_by_slug(slug: str, ep: int):
    """Embed player route by anime slug."""
    embed_file = TEMPLATES_DIR / "embed.html"
    if not embed_file.exists():
        raise HTTPException(status_code=404, detail="Embed template not found")
    return FileResponse(str(embed_file))


# --------------------------------------------------------------------------
# API Endpoints
# --------------------------------------------------------------------------
@app.get("/api", tags=["API"])
async def api_root():
    """API JSON root."""
    return {"name": "AnimeXOsource_Owais", "version": "1.0.0"}


@app.get("/api/search", tags=["API"])
@app.get("/api/anime", tags=["API"])
async def api_search(
    q: Optional[str] = Query(None, description="Anime title search term"),
    page: int = Query(1, ge=1, description="Page number"),
    perPage: int = Query(20, ge=1, le=50, description="Items per page"),
    genre: Optional[str] = Query(None, description="Genre filter"),
    sort: Optional[str] = Query(None, description="Sort order: trending, score, etc."),
):
    """AniList GraphQL search proxy."""
    try:
        return await anilist.search_anime(q=q, page=page, per_page=perPage, genre=genre, sort=sort)
    except Exception as e:
        logger.error("Search failed: %s", e)
        raise HTTPException(status_code=502, detail=f"AniList query failure: {str(e)}")


@app.get("/api/anime/{slug}", tags=["API"])
async def api_anime_detail(slug: str):
    """Single anime metadata and episode list."""
    anilist_id = anilist.decode_slug(slug)
    if not anilist_id:
        # Fallback to searching the slug directly
        search_res = await anilist.search_anime(q=slug.split("-")[0], per_page=1)
        results = search_res.get("results") or []
        if results:
            anilist_id = results[0]["anilistId"]

    if not anilist_id:
        raise HTTPException(status_code=404, detail=f"Anime '{slug}' not found")

    anime = await anilist.get_anime_by_id(anilist_id)
    if not anime:
        raise HTTPException(status_code=404, detail=f"Anime with ID {anilist_id} not found")
    return anime


@app.get("/api/stream/{slug}/{ep}", tags=["API"])
async def api_stream(
    slug: str,
    ep: int,
    lang: str = Query("sub", description="Audio track: sub or dub"),
):
    """
    Returns resolved stream sources, subtitles, and skip markers.
    Returns HTTP 503 if resolver is unconfigured.
    """
    # Try resolving AniList / MAL IDs for metadata
    anilist_id = anilist.decode_slug(slug)
    mal_id = anilist_id
    title_str = slug
    duration_val = 1440

    if anilist_id:
        try:
            anime_meta = await anilist.get_anime_by_id(anilist_id)
            if anime_meta:
                mal_id = anime_meta.get("malId") or anilist_id
                t_obj = anime_meta.get("title") or {}
                title_str = t_obj.get("english") or t_obj.get("romaji") or slug
        except Exception:
            pass

    try:
        resolved = await resolve(slug_or_id=slug, episode=ep, lang=lang, mal_id=mal_id)
    except ResolverError as e:
        logger.error("Stream resolution failed: %s", e)
        if "resolver not configured" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "error": "resolver not configured",
                    "detail": "Set RESOLVER_BASE in the environment to enable stream resolution.",
                },
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "stream resolution error", "detail": str(e)},
        )

    return {
        "slug": slug,
        "episode": ep,
        "title": title_str,
        "malId": mal_id,
        "anilistId": anilist_id,
        "duration": duration_val,
        "sources": resolved.get("sources", []),
        "subtitles": resolved.get("subtitles", []),
        "skip": resolved.get("skip", {}),
    }


@app.get("/api/health", tags=["API"])
@app.get("/health", tags=["API"])
async def api_health():
    """Cluster health and telemetry ping status."""
    servers = await probe_servers()
    uptime_sec = int(time.time() - START_TIME)
    return {
        "status": "ok",
        "uptime": uptime_sec,
        "servers": servers,
    }


@app.get("/api/embed-code", tags=["API"])
async def api_embed_code(
    request: Request,
    slug: str = Query(..., description="Anime slug or ID"),
    ep: int = Query(1, ge=1, description="Episode number"),
):
    """Generate direct URL and responsive iframe embed snippet."""
    base_url = str(request.base_url).rstrip("/")
    direct_url = f"{base_url}/embed/{slug}/{ep}"
    iframe_code = (
        f'<iframe src="{direct_url}" width="100%" height="100%" '
        f'frameborder="0" allowfullscreen allow="autoplay; fullscreen; picture-in-picture"></iframe>'
    )
    return {
        "iframe": iframe_code,
        "direct": direct_url,
    }


@app.post("/api/shield/validate", tags=["API"])
async def api_shield_validate(payload: Dict[str, Any]):
    """Internal validation for HMAC-signed URLs."""
    url = payload.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="Missing url parameter")
    is_valid = shield.validate_request(url)
    return {"valid": is_valid, "url": url}


# --------------------------------------------------------------------------
# Main Local Boot
# --------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("reanime.app:app", host="127.0.0.1", port=8000, reload=True)
