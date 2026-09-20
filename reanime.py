#!/usr/bin/env python3
"""Entrypoint for ReAnime.to API (backwards compatibility)."""

import os
import uvicorn
from reanime.app import app

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("reanime.app:app", host=host, port=port, workers=1, reload=False)
