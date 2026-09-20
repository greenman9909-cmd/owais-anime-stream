import asyncio
from fastapi.testclient import TestClient
from reanime.app import app

def test_all_endpoints():
    print("Testing FastAPI app with TestClient...")
    with TestClient(app) as client:
        # 1. Health
        r_health = client.get("/health")
        print("GET /health:", r_health.status_code, r_health.json())
        assert r_health.status_code == 200
        assert r_health.json()["status"] == "ok"

        # 2. Root
        r_root = client.get("/")
        print("GET /:", r_root.status_code, r_root.json().get("service"))
        assert r_root.status_code == 200

        # 3. Search
        r_search = client.get("/search?q=one+piece&limit=2")
        print("GET /search:", r_search.status_code)
        assert r_search.status_code == 200

        # 4. Home
        r_home = client.get("/home?limit=2")
        print("GET /home:", r_home.status_code, "keys:", list(r_home.json().keys()))
        assert r_home.status_code == 200

        # 5. Top
        r_top = client.get("/top?period=week&limit=2")
        print("GET /top:", r_top.status_code)
        assert r_top.status_code == 200

        # 6. Schedule
        r_sched = client.get("/schedule")
        print("GET /schedule:", r_sched.status_code)
        assert r_sched.status_code == 200

        # 7. Info
        r_info = client.get("/info/one-piece-xamk74")
        print("GET /info/one-piece-xamk74:", r_info.status_code, "anilist_id:", r_info.json().get("anilist_id"))
        assert r_info.status_code == 200

        # 8. Episodes
        r_eps = client.get("/episodes/one-piece-xamk74")
        print("GET /episodes/one-piece-xamk74:", r_eps.status_code, "count:", len(r_eps.json()))
        assert r_eps.status_code == 200

        # 9. Servers
        r_servers = client.get("/servers/one-piece-xamk74/1")
        print("GET /servers/one-piece-xamk74/1:", r_servers.status_code, "sub count:", len(r_servers.json().get("sub", [])))
        assert r_servers.status_code == 200
        servers_data = r_servers.json()
        assert len(servers_data["sub"]) > 0
        first_sub = servers_data["sub"][0]
        print("First sub server:", first_sub)

        # 10. Stream from link
        link = first_sub["dataLink"]
        r_stream = client.get(f"/stream/from-link?link={link}")
        print("GET /stream/from-link:", r_stream.status_code)
        assert r_stream.status_code == 200
        stream_json = r_stream.json()
        print("Resolved stream URL:", stream_json.get("url")[:70] + "...")
        assert stream_json.get("url", "").startswith("http")

        # 11. CORS preflight check
        r_cors = client.options(
            "/search",
            headers={
                "Origin": "https://owais-anime-stream.onrender.com",
                "Access-Control-Request-Method": "GET",
            }
        )
        print("CORS OPTIONS status:", r_cors.status_code, "Allow-Origin:", r_cors.headers.get("access-control-allow-origin"))
        assert r_cors.headers.get("access-control-allow-origin") == "https://owais-anime-stream.onrender.com"

        # 12. Frontend adapter /api/anime
        r_adapter = client.get("/api/anime?perPage=2")
        print("GET /api/anime:", r_adapter.status_code, "results:", len(r_adapter.json().get("results", [])))
        assert r_adapter.status_code == 200

        print("\nALL BACKEND API TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_all_endpoints()
