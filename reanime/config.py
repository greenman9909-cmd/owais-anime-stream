import os

CONFIG = {
    "resolver_base":    os.getenv("RESOLVER_BASE", ""),
    "resolver_key":     os.getenv("RESOLVER_KEY", ""),
    "shield_secret":    os.getenv("SHIELD_SECRET", "change-me"),
    "studio_token":     os.getenv("STUDIO_TOKEN", ""),
    "servers": [
        {"name": "Sora Edge", "region": "US-East",  "host": os.getenv("SORA_HOST",  "")},
        {"name": "Neko CDN",  "region": "EU-West",  "host": os.getenv("NEKO_HOST",  "")},
        {"name": "Zozo Edge", "region": "AP-South", "host": os.getenv("ZOZO_HOST",  "")},
    ],
    "anilist_url": "https://graphql.anilist.co",
    "aniskip_url": "https://api.aniskip.com/v2",
    "cache": {
        "catalog_ttl": 3600,
        "stream_ttl": 120,
        "skip_ttl": 86400,
    },
}
