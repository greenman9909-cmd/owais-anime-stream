# Deploying on Render

AnimeXOsource_Owais can run on Render as a Docker web service. The repository already contains the required [`Dockerfile`](../Dockerfile) and [`render.yaml`](../render.yaml).

## Blueprint deployment

1. Push the repository to GitHub.
2. Open the [Render Dashboard](https://dashboard.render.com/).
3. Select **New +**, then **Blueprint**.
4. Choose the repository and the `main` branch.
5. Review the service name, Docker runtime, Frankfurt region, and free plan.
6. Create the Blueprint and wait for the first build.

The service listens on `PORT`, which Render supplies at runtime. The repository defaults to port `8000` and exposes `/api/health` as the health endpoint.

## Environment variables

Set the following values in Render’s environment settings:

```text
PORT=8000
SHIELD_SECRET=<random-32-byte-hex-secret>
RESOLVER_BASE=
RESOLVER_KEY=
```

Generate a secret locally with:

```bash
openssl rand -hex 32
```

`RESOLVER_BASE` and `RESOLVER_KEY` are optional. Configure them only for a resolver service and media sources that you are authorized to use. Never commit these values to GitHub.

## Verification

After the deploy becomes live, run:

```bash
BASE_URL="https://your-service.onrender.com"

curl -i "$BASE_URL/"
curl -i "$BASE_URL/api/health"
curl -i "$BASE_URL/docs"
curl -i "$BASE_URL/openapi.json"
curl -i "$BASE_URL/embed/ani/21/1?track=sub"
curl -i "$BASE_URL/api/stream/21/1?lang=sub"
```

Expected baseline results are HTTP 200 for the root page, health endpoint, Swagger UI, OpenAPI document, and embed page. The stream endpoint depends on the configured provider. A provider-side outage or authorization failure should be treated as an upstream issue, not as a Render build failure.

## Auto deploys

Render watches the configured branch. A push to `main` starts a new build automatically when auto deploy is enabled. Use the Render deploy log to distinguish these stages:

- **Build:** Docker image creation and dependency installation.
- **Start:** Uvicorn binds to `0.0.0.0:$PORT`.
- **Health:** Render requests `/api/health`.
- **Runtime:** API, studio, and embed routes accept traffic.

## Free-tier notes

The free service can sleep after inactivity and may need several seconds to wake up. SQLite data inside an ephemeral service should not be treated as durable production storage. Use managed storage or a persistent database if accounts, comments, or other user data must survive redeploys.

## Security checklist

Use a unique production `SHIELD_SECRET`, keep resolver credentials private, restrict CORS when embedding in a known set of hosts, and avoid exposing debug data in public logs. Review provider terms, copyright requirements, privacy obligations, and local laws before enabling media sources.
