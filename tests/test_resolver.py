"""Tests for pluggable stream resolver and upstream normalization."""

import pytest
from reanime.config import CONFIG
from reanime.resolver import ResolverError, normalize_upstream_response, resolve


@pytest.mark.asyncio
async def test_unconfigured_resolver_raises_error():
    # When unconfigured, resolve() must raise ResolverError
    CONFIG["resolver_base"] = ""
    CONFIG["disable_builtin"] = True
    try:
        with pytest.raises(ResolverError, match="resolver not configured"):
            await resolve(slug_or_id="one-piece-xamk74", episode=1)
    finally:
        CONFIG["disable_builtin"] = False


def test_normalize_upstream_response_generates_3_failovers():
    upstream_payload = {
        "sources": [
            {"server": "HD-2", "url": "https://edge1.node.com/hls/master.m3u8", "type": "hls"}
        ],
        "subtitles": [
            {"lang": "en", "label": "English", "url": "https://cdn.sub.com/en.vtt", "default": True}
        ],
        "skip": {
            "intro": {"start": 85.0, "end": 175.0}
        }
    }

    normalized = normalize_upstream_response(upstream_payload)

    # Must contain 3 failover sources in priority order: HD-2 (1), HD-1 (2), SD-1 (3)
    sources = normalized["sources"]
    assert len(sources) == 3
    assert sources[0]["server"] == "HD-2"
    assert sources[0]["priority"] == 1
    assert sources[1]["server"] == "HD-1"
    assert sources[1]["priority"] == 2
    assert sources[2]["server"] == "SD-1"
    assert sources[2]["priority"] == 3

    # All sources must be signed with HMAC tokens
    for s in sources:
        assert "t=" in s["signed"]
        assert "e=" in s["signed"]

    # Subtitles must be normalized
    assert len(normalized["subtitles"]) == 1
    assert normalized["subtitles"][0]["lang"] == "en"

    # Skip times must be preserved
    assert normalized["skip"]["intro"]["start"] == 85.0


def test_normalize_empty_sources_raises_error():
    empty_payload = {"sources": []}
    with pytest.raises(ResolverError, match="no stream sources"):
        normalize_upstream_response(empty_payload)


@pytest.mark.asyncio
async def test_builtin_fallback_when_decryption_fails(monkeypatch):
    """Verify resolver falls back to direct server embed links if WASM token decryption fails (HTTP 403 on datacenter IP)."""
    import httpx
    from reanime import resolver

    # Mock anilist search to return aid 21
    async def mock_search(*args, **kwargs):
        return {"results": [{"anilistId": 21}]}

    monkeypatch.setattr("reanime.anilist.search_anime", mock_search)

    # Mock flix response with servers and dataLink
    class MockFlixResponse:
        status_code = 200
        def json(self):
            return {
                "servers": [
                    {"serverName": "HD-2", "dataType": "sub", "dataLink": "https://flixcloud.cc/e/test1234"},
                    {"serverName": "HD-1", "dataType": "sub", "dataLink": "https://flixcloud.cc/e/test5678"}
                ]
            }

    class MockEmbedResponse:
        status_code = 200
        content = b"<html>mock</html>"

    original_get = httpx.AsyncClient.get

    async def mock_get(self, url, *args, **kwargs):
        url_str = str(url)
        if "api/flix" in url_str:
            return MockFlixResponse()
        if "flixcloud.cc/e" in url_str:
            return MockEmbedResponse()
        return await original_get(self, url, *args, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    # Force decrypt_embed_html to fail with HTTP 403 simulation
    async def mock_decrypt_fail(content):
        raise resolver.ResolverError("CDN token resolution error: HTTP 403 from https://flixcloud.cc/api/m3u8/token")

    monkeypatch.setattr(resolver, "decrypt_embed_html", mock_decrypt_fail)

    result = await resolver.resolve("21", 1, "sub")
    assert "sources" in result
    assert len(result["sources"]) == 2
    assert result["sources"][0]["type"] == "embed"
    assert result["sources"][0]["embed"] == "https://flixcloud.cc/e/test1234"
    assert result["sources"][1]["embed"] == "https://flixcloud.cc/e/test5678"

