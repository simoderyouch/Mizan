<p align="center">
  <img src="docs/assets/MIZAN_FULL_LOGO.png" alt="Mizan" width="320" />
</p>

<h1 align="center">Mizan</h1>

<p align="center">
  <strong>AI-powered student wellbeing platform</strong> — daily rituals, academic context, and an autonomous agent that nudges, plans, and supports recovery.
</p>

<p align="center">
  <a href="#screenshots">Screenshots</a> ·
  <a href="#features">Features</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#repository-structure">Structure</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#testing--quality">Quality</a> ·
  <a href="#deployment">Deployment</a>
</p>

---

## Overview

**Mizan** helps students track mood and habits through **morning and evening check-ins** (text, QCM, or voice), while grounding recommendations in **real academic context**: class schedule, exams, and projects. School administrators manage institutions, import students, and view aggregate wellbeing analytics.

An **event-driven autonomous agent** (Mistral-backed) reacts to check-ins and chat: creating tasks, suggesting focus modes, delivering resources, and opening **action contracts** students can accept or decline—with idempotency, cooldowns, and safety gates for high-risk content.

| Layer | Technology |
|-------|------------|
| API | Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic |
| Database | PostgreSQL |
| Web | Next.js 15, TypeScript, Tailwind |
| Mobile | Expo, React Native |
| AI | Mistral (LLM, STT, TTS, realtime transcription) |
| Media | Cloudinary |
| Infra | Docker Compose (local), AWS ECS + RDS + CloudFront (staging/production) |
| CI | GitHub Actions — backend tests, frontend build, mobile typecheck, optional AWS deploy |

**License:** [MIT](./LICENSE)

---

## Screenshots

<table>
  <tr>
    <td width="50%">
      <a href="docs/screenshots/landing.png">
        <img src="docs/screenshots/landing.png" alt="Mizan landing page" width="100%" />
      </a>
      <br /><em>Landing — student wellbeing positioning and product pillars</em>
    </td>
    <td width="50%">
      <a href="docs/screenshots/login.png">
        <img src="docs/screenshots/login.png" alt="Mizan sign-in" width="100%" />
      </a>
      <br /><em>Sign-in — activation flow and secure access</em>
    </td>
  </tr>
</table>

---

## Features

### Students
- Morning / evening check-ins with dynamic questions and AI-generated summaries
- Voice check-in pipeline (guided questions, STT, analysis, optional realtime stream)
- Goals, tasks, and focus **modes** (revision, exam, project, rest, …)
- Agent chat, daily plans, and **action contracts** with follow-up notifications
- Real-time notifications via WebSocket
- Personal analytics: mood trends, weekly report, mode distribution

### Administrators
- Multi-level institution model: school → filière → promotion → class
- Student provisioning and **CSV trombinoscope** import
- Class schedules, exams, and projects (manual + CSV)
- School-scoped vs global admin permissions
- Admin analytics dashboard

### Platform
- JWT authentication with refresh tokens and optional email activation (SMTP)
- Rate limiting on auth endpoints
- Production-hardened settings validation (CORS, secret key strength)
- Background scheduler for periodic wellbeing scans
- OpenAPI at `/docs` on the backend

---

## Architecture

High-level diagrams and ER flows live in **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**.

| Diagram | Description |
|---------|-------------|
| [Container](./docs/architecture/container_diagram.png) | Web, mobile, API, PostgreSQL, external services |
| [AWS](./docs/architecture/mizan-aws.png) | ECS, RDS, ALB, CloudFront |
| [Use cases](./docs/architecture/usecase_diagram_rapport.png) | Actor capabilities |
| [Domain model](./docs/architecture/class_diagram_rapport.png) | Core entities |
| [Check-in flow](./docs/architecture/checkin_seq_uml.png) | Morning ritual + agent trigger |

```mermaid
flowchart TB
  subgraph clients
    FE[mizan-frontend]
    MO[mizan-mobile-app]
  end
  subgraph backend[mizan-backend]
    API[FastAPI /api/v1]
    SVC[Services + Agent orchestrator]
  end
  DB[(PostgreSQL)]
  MISTRAL[Mistral AI]
  FE --> API
  MO --> API
  API --> SVC
  SVC --> DB
  SVC --> MISTRAL
```

---

## Repository structure

```text
mizan/
├── mizan-backend/       # FastAPI API, Alembic migrations, pytest suite
├── mizan-frontend/      # Next.js web app (admin + student)
├── mizan-mobile-app/    # Expo student app
├── docs/                # Architecture diagrams and assets
├── infra/aws/           # Terraform (ECS, RDS, CloudFront, …)
├── docker-compose.yml   # Local full stack (Postgres + API + web + nginx)
├── DEPLOYMENT_README.md # AWS + EAS deployment guide
└── .github/workflows/   # CI/CD
```

| Package | README |
|---------|--------|
| Backend API | [mizan-backend/README.md](./mizan-backend/README.md) |
| Web | [mizan-frontend](./mizan-frontend) — `npm run dev` |
| Mobile | [mizan-mobile-app/README.md](./mizan-mobile-app/README.md) |
| AWS Terraform | [infra/aws/README.md](./infra/aws/README.md) |

---

## Quick start

### Prerequisites

- Docker & Docker Compose **or** local PostgreSQL
- Python 3.12+, Node.js 20+
- API keys: `MISTRAL_API_KEY` (AI features), `CLOUDINARY_*` (photos), optional SMTP

### Option A — Docker Compose (recommended)

```bash
cp mizan-backend/.env.example mizan-backend/.env
# Set SECRET_KEY, DATABASE_URL, MISTRAL_API_KEY, etc.

docker compose up --build
```

- API: `http://localhost:8000` · Swagger: `http://localhost:8000/docs`
- Web: `http://localhost:3000` (or port from `FRONTEND_PORT`)

### Option B — Run services separately

**Backend**

```bash
cd mizan-backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Web**

```bash
cd mizan-frontend
npm ci
cp .env.local.example .env.local
npm run dev
```

**Mobile**

```bash
cd mizan-mobile-app
npm ci
cp .env.example .env
npm start
```

Set `EXPO_PUBLIC_API_URL` to your machine LAN IP when testing on a physical device.

### First admin user

Use the institutional onboarding flow in the web app, or run once (with DB reachable):

```bash
cd mizan-backend
export ADMIN_EMAIL="admin@your-org.com"
export ADMIN_PASSWORD="your-strong-password"
python create_global_admin.py
```

Do **not** commit real credentials. Rotate `SECRET_KEY` and passwords in any shared environment.

**Staging demo data:** after deploy, run `./scripts/seed-sample-data.sh` (see [docs/SAMPLE_DATA.md](./docs/SAMPLE_DATA.md)). Production uses [DEPLOYMENT_README.md](./DEPLOYMENT_README.md) bootstrap flows instead.

---

## Testing & quality

**Backend** (from `mizan-backend/`):

```bash
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/mizan_test"
export SECRET_KEY="local-test-secret-key-min-32-chars-long"
export ENABLE_SCHEDULER=false
python -m pytest
```

Covers agent orchestration, notifications, safety/privacy, task suggestions, analytics windows, and deploy-readiness settings.

**Frontend**

```bash
cd mizan-frontend && npm ci && npm run lint && npm run build
```

**CI** — on every PR and push to `main`: `.github/workflows/ci-cd.yml`.

---

## Deployment

Full guide: **[DEPLOYMENT_README.md](./DEPLOYMENT_README.md)**

- Backend + web on **AWS ECS Fargate**, **RDS PostgreSQL**, **CloudFront**
- Mobile via **EAS Build** (not hosted on AWS)
- Optional GitHub Actions deploy when `AWS_DEPLOY_ENABLED=true`

---

## Security

Never commit:

- `.env`, `.env.compose`, credentials, or database dumps
- Private keys or cloud access tokens

Production checklist:

- Strong `SECRET_KEY` (validated in production mode)
- Explicit `BACKEND_CORS_ORIGINS` (no wildcards in production)
- Private RDS, HTTPS via CloudFront/ALB
- Secrets in AWS Secrets Manager
- Budget alerts and a tested `destroy` workflow for non-production environments

---

## Repository notes

- **Thesis / report material** (`rapport/`) is intentionally **local only** (gitignored) and not part of this repository.
- Architecture diagrams for GitHub live under `docs/architecture/` (copied from design artifacts).

<p align="center">
  <img src="docs/assets/MIZAN_ICON.png" alt="Mizan icon" width="64" />
</p>
