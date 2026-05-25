# Mizan Backend Deploy-Ready Checklist

This checklist tracks what is implemented in the backend and what still needs real deployment values before public launch.

## Implemented

- `BACKEND_CORS_ORIGINS` config replaces wildcard CORS.
- Production rejects `BACKEND_CORS_ORIGINS=*`.
- Production rejects weak/default `SECRET_KEY` values.
- Production rejects a default `postgres` password in `DATABASE_URL`.
- `ENABLE_SCHEDULER` controls autonomous scheduler startup.
- Image, audio, and CSV upload size limits are configurable.
- Upload MIME type and extension checks are enforced.
- Auth/OTP endpoints have a basic in-process rate limiter.
- Missing Cloudinary configuration returns a clean `503`.
- Startup resource seeding is non-destructive.
- Docker Compose binds app/database ports to `127.0.0.1`; Nginx is the public entry point.
- CI/CD workflow exists at `.github/workflows/ci-cd.yml`.

## Required Real Values Before Public Deploy

Set these in `.env.compose` or GitHub Actions secrets. Do not commit them.

```env
APP_ENV=production
SECRET_KEY=<long-random-secret>
POSTGRES_PASSWORD=<strong-password>
BACKEND_CORS_ORIGINS=https://mizan.<DOMAIN>
NEXT_PUBLIC_API_URL=https://api.<DOMAIN>
NEXT_PUBLIC_WS_URL=wss://api.<DOMAIN>/api/v1/voice/realtime
```

Provider values needed for full feature support:

```env
MISTRAL_API_KEY=<key>
CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>
SMTP_USER=<email>
SMTP_PASSWORD=<app-password>
```

## GitHub Actions CI/CD

The workflow runs on pull requests and pushes to `main`:

- backend compile check and tests
- frontend lint and build
- mobile TypeScript check

Deploy runs only on pushes to `main`, after CI passes.

Add these GitHub repository secrets before enabling automatic deploy:

```text
DEPLOY_HOST=<server-ip-or-domain>
DEPLOY_USER=<ssh-user>
DEPLOY_PORT=22
DEPLOY_PATH=/home/<ssh-user>/mizan
DEPLOY_SSH_KEY=<private-ssh-key-for-the-server>
ENV_COMPOSE_BASE64=<base64 encoded .env.compose>
DEPLOY_HEALTH_URL=https://api.<DOMAIN>/health
```

Create `ENV_COMPOSE_BASE64` locally:

```bash
base64 -w 0 .env.compose
```

If deploy secrets are missing, CI still runs and the deploy job safely skips deployment.

## Deploy Commands

```bash
docker compose --env-file .env.compose up -d --build
docker compose --env-file .env.compose ps
docker compose --env-file .env.compose logs -f backend
curl -fsS https://api.<DOMAIN>/health
curl -fsS https://api.<DOMAIN>/api/v1/health/detailed
```

## Go / No-Go

Deploy is a GO only if all are true:

- `SECRET_KEY` is strong and not default.
- `POSTGRES_PASSWORD` is strong and not default.
- Public access uses HTTPS.
- `BACKEND_CORS_ORIGINS` contains only the real frontend domains.
- Database and backend ports are not open publicly.
- `alembic upgrade head` succeeds.
- Backend tests pass.
- File uploads are size/type limited.
- Scheduler is not duplicated across multiple backend containers.
- Backup and restore test has been done.

Deploy is a NO-GO if any are true:

- `SECRET_KEY=change-me-in-production`.
- `POSTGRES_PASSWORD=postgres` on a public server.
- API is exposed over plain HTTP only.
- Postgres port `5432` is open to the internet.
- Backend port `8000` is open to the internet without Nginx/HTTPS.
- CORS allows `*` in production.
- Migrations fail.
