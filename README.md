# Mizan

Mizan is a student wellbeing platform with a FastAPI backend, a Next.js web frontend, and an Expo React Native mobile app.

## Applications

- `mizan-backend`: FastAPI API, PostgreSQL, SQLAlchemy, Alembic.
- `mizan-frontend`: production web application.
- `mizan-mobile-app`: Expo React Native mobile application.
- `mizan-frontend-pwa`: local development/test only. It is ignored by git and is not deployed.

## Local Development

Backend:

```bash
cd mizan-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Web frontend:

```bash
cd mizan-frontend
npm install
npm run dev
```

Mobile app:

```bash
cd mizan-mobile-app
npm install
cp .env.example .env
npm start
```

## Deployment

Production deployment uses Docker Compose with:

- backend
- frontend
- PostgreSQL
- Nginx
- Certbot

Read the full deployment guide:

[DEPLOYMENT_README.md](./DEPLOYMENT_README.md)

## CI/CD

GitHub Actions workflow:

```text
.github/workflows/ci-cd.yml
```

The workflow runs backend tests, frontend build checks, mobile typecheck, and deploys to the configured server after pushes to `main` when deploy secrets are available.

## Security

Do not commit:

- `.env`
- `.env.compose`
- database dumps
- cloud provider credentials
- private SSH keys

Production requires strong `SECRET_KEY`, strong database password, HTTPS, restricted CORS, and tested backups.
