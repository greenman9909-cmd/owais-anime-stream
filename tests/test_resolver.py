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
