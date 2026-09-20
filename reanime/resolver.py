"""Node.js WebAssembly bridge for resolving CDN playback streams and decrypting rotating AES-256-CBC tokens."""

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException

logger = logging.getLogger("reanime.resolver")

BASE_DIR = Path(__file__).resolve().parent.parent
NODE_RESOLVER_SCRIPT = BASE_DIR / "node" / "resolve.js"

FLIX_BASE = "https://flixcloud.cc"
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


async def decrypt_embed_html(html_bytes: bytes) -> Dict[str, Any]:
    """Execute node/resolve.js subprocess to unpack WASM and decrypt AES-256-CBC token payload."""
    if not NODE_RESOLVER_SCRIPT.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Resolver script not found at {NODE_RESOLVER_SCRIPT}",
        )

    try:
        proc = await asyncio.create_subprocess_exec(
            "node",
            str(NODE_RESOLVER_SCRIPT),
            "-",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=html_bytes), timeout=25.0
        )
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        logger.error("WASM decryption subprocess timed out after 25 seconds")
        raise HTTPException(status_code=504, detail="Decryption subprocess timed out")
    except Exception as e:
        logger.exception("Failed to spawn node resolver subprocess: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to run node resolver: {str(e)}")

    if proc.returncode != 0:
        err_msg = stderr.decode("utf-8", errors="replace").strip()
        logger.error("Node resolver exited with code %d: %s", proc.returncode, err_msg)
        raise HTTPException(
            status_code=502,
            detail=f"CDN token resolution error: {err_msg[:300]}",
        )

    try:
        data = json.loads(stdout.decode("utf-8"))
        return data
    except json.JSONDecodeError as e:
        logger.error("Failed to parse resolver JSON output: %s", e)
        raise HTTPException(status_code=502, detail="Invalid JSON from CDN resolver")


async def resolve_stream(
    client: httpx.AsyncClient,
    access_id: str,
    v: int = 2,
) -> Dict[str, Any]:
    """Fetch Flixcloud embed HTML by access ID and decrypt via Node WASM bridge."""
    embed_url = f"{FLIX_BASE}/e/{access_id}?v={v}"
    try:
        res = await client.get(
            embed_url,
            headers=HEADERS,
            timeout=httpx.Timeout(20.0),
        )
    except Exception as e:
        logger.error("Network error fetching embed URL %s: %s", embed_url, e)
        raise HTTPException(status_code=502, detail=f"Failed to fetch embed page: {str(e)}")

    if res.status_code == 404:
        raise HTTPException(status_code=404, detail="Embed source not found")
    if not res.is_success:
        raise HTTPException(
            status_code=res.status_code,
            detail=f"Embed server returned error {res.status_code}",
        )

    return await decrypt_embed_html(res.content)
