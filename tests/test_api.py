"""Tests for AnimeXOsource_Owais web platform and API endpoints."""

from fastapi.testclient import TestClient
from reanime.app import app
from reanime.config import CONFIG
from reanime import shield


def test_root_web_platform():
    """Verify root / serves the AnimeXOsource_Owais web platform."""
    with TestClient(app) as client:
        res = client.get("/")
        assert res.status_code == 200
        assert "AnimeXOsource_Owais" in res.text
        assert "text/html" in res.headers.get("content-type", "")


def test_api_root():
    """Verify /api JSON root metadata."""
    with TestClient(app) as client:
        res = client.get("/api")
        assert res.status_code == 200
        data = res.json()
        assert data.get("name") == "AnimeXOsource_Owais"
        assert "version" in data


def test_embed_player_routes():
    """Verify /embed/* routes serve the standalone player HTML."""
    with TestClient(app) as client:
        # AniList route
        r_ani = client.get("/embed/ani/21/1")
        assert r_ani.status_code == 200
        assert "AnimeXOsource_Owais" in r_ani.text

        # MyAnimeList route
        r_mal = client.get("/embed/mal/21/1")
        assert r_mal.status_code == 200
        assert "AnimeXOsource_Owais" in r_mal.text

        # Slug route
        r_slug = client.get("/embed/one-piece-xamk74/1")
        assert r_slug.status_code == 200
        assert "AnimeXOsource_Owais" in r_slug.text


def test_cluster_health_telemetry():
    """Verify /api/health and /health return 3 cluster servers."""
    with TestClient(app) as client:
        res = client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data.get("status") == "ok"
        servers = data.get("servers", [])
        assert len(servers) == 3

        names = [s.get("name") for s in servers]
        assert "Sora Edge" in names
        assert "Neko CDN" in names
        assert "Zozo Edge" in names

        # /health alias
        res_alias = client.get("/health")
        assert res_alias.status_code == 200
        assert res_alias.json().get("status") == "ok"


def test_stream_unconfigured_resolver_returns_503():
    """Verify /api/stream returns HTTP 503 when RESOLVER_BASE is empty and unconfigured."""
    CONFIG["resolver_base"] = ""
    CONFIG["disable_builtin"] = True
    try:
        with TestClient(app) as client:
            res = client.get("/api/stream/one-piece-xamk74/1")
            assert res.status_code == 503
            data = res.json()
            assert data.get("error") == "resolver not configured"
            assert "RESOLVER_BASE" in data.get("detail", "")
    finally:
        CONFIG["disable_builtin"] = False


def test_embed_code_generation():
    """Verify /api/embed-code endpoint."""
    with TestClient(app) as client:
        res = client.get("/api/embed-code?slug=one-piece-xamk74&ep=1")
        assert res.status_code == 200
        data = res.json()
        assert "iframe" in data
        assert "direct" in data
        assert "embed/one-piece-xamk74/1" in data["iframe"]
        assert "embed/one-piece-xamk74/1" in data["direct"]


def test_shield_validate_endpoint():
    """Verify /api/shield/validate validates signed and unsigned URLs."""
    raw_url = "https://cdn.example.com/hls/stream.m3u8"
    signed_url = shield.sign(raw_url, ttl_seconds=3600)

    with TestClient(app) as client:
        # Valid signed URL
        res_valid = client.post("/api/shield/validate", json={"url": signed_url})
        assert res_valid.status_code == 200
        assert res_valid.json().get("valid") is True

        # Unsigned URL
        res_invalid = client.post("/api/shield/validate", json={"url": raw_url})
        assert res_invalid.status_code == 200
        assert res_invalid.json().get("valid") is False


def test_catalog_search():
    """Verify /api/search proxy returns JSON or handles upstream cleanly."""
    with TestClient(app) as client:
        res = client.get("/api/search?q=one+piece&perPage=3")
        # May be 200 if online, or 502 if AniList rate limits or fails in sandbox
        assert res.status_code in (200, 502)
        if res.status_code == 200:
            data = res.json()
            assert "results" in data
