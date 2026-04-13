# Mizan Backend

Backend API for the Mizan student wellbeing platform, built with **FastAPI + SQLAlchemy (async) + PostgreSQL**.

## What this service does

This backend provides:

- Authentication and role-based access (admin/student)
- Institutional hierarchy management (school -> filiere -> promotion -> class)
- Student provisioning and CSV imports
- Check-ins (morning/evening), goals, and mode sessions
- AI-assisted planning/chat and voice analysis
- Analytics dashboards (student + admin)
- Student photo upload/delete via Cloudinary

Base API prefix: `/api/v1`

---

## Tech stack

- Python 3.12+
- FastAPI
- SQLAlchemy 2.x (async)
- Alembic (migrations)
- PostgreSQL (`asyncpg`)
- JWT (`python-jose`)
- Password hashing (`passlib[bcrypt]`)
- AI providers:
  - Mistral (text agent, STT, TTS, realtime transcription)
- Cloudinary (photo storage)

---

## Repository layout

```text
mizan-backend/
├── app/
│   ├── api/v1/routes/        # HTTP endpoints grouped by domain
│   ├── core/                 # config, DB, auth dependencies, security
│   ├── models/               # SQLAlchemy models
│   ├── schemas/              # Pydantic request/response models
│   ├── services/             # business logic
│   └── utils/                # helpers (CSV parsing, etc.)
├── alembic/                  # migrations
├── main.py                   # FastAPI app entrypoint
└── requirements.txt
```

---

## Prerequisites

- Python 3.12+
- PostgreSQL database
- API keys/services for enabled features:
  - Mistral
  - Cloudinary
  - (Optional email OTP) SMTP credentials

---

## Setup

From `mizan-backend/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run DB migrations:

```bash
alembic upgrade head
```

Start API:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open:

- Swagger: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Health: `http://localhost:8000/health`

---

## Environment variables

Create `.env` in `mizan-backend/`.

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | Async SQLAlchemy URL (e.g. `postgresql+asyncpg://...`) |
| `SECRET_KEY` | JWT signing secret |
| `MISTRAL_API_KEY` | Mistral API key |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |

### Optional (with defaults)

| Variable | Default | Description |
|---|---:|---|
| `APP_ENV` | `development` | Enables SQL echo in dev |
| `USE_LOCAL_DATABASE` | `false` | If `true`, API uses `LOCAL_DATABASE_URL` instead of `DATABASE_URL` |
| `LOCAL_DATABASE_URL` | empty | Local PostgreSQL URL used when `USE_LOCAL_DATABASE=true` |
| `DB_POOL_SIZE` | `10` | SQLAlchemy pool size for async engine |
| `DB_MAX_OVERFLOW` | `20` | Extra temporary connections above pool size |
| `DB_POOL_TIMEOUT` | `30` | Seconds to wait for a pooled connection |
| `DB_POOL_RECYCLE` | `1800` | Seconds before recycled pooled connection |
| `DB_POOL_PRE_PING` | `true` | Validate pooled connection before use |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token TTL |
| `SMTP_SERVER` | `smtp.gmail.com` | OTP email host |
| `SMTP_PORT` | `587` | OTP email port |
| `SMTP_USER` | empty | OTP email user |
| `SMTP_PASSWORD` | empty | OTP email password |
| `MISTRAL_MODEL` | `mistral-large-latest` | Mistral model |
| `MISTRAL_STT_MODEL` | `voxtral-mini-latest` | Mistral STT model |
| `MISTRAL_STT_LANGUAGE` | `fr` | STT language |
| `MISTRAL_REALTIME_MODEL` | `voxtral-mini-transcribe-realtime-2602` | Mistral realtime STT model |
| `MISTRAL_REALTIME_SAMPLE_RATE` | `16000` | PCM sample rate for realtime stream |
| `MISTRAL_REALTIME_TARGET_DELAY_MS` | `700` | Realtime transcription latency/accuracy tradeoff |
| `MISTRAL_REALTIME_SERVER_URL` | `wss://api.mistral.ai` | Mistral realtime websocket base URL |
| `MISTRAL_TTS_MODEL` | `voxtral-mini-tts-latest` | Mistral TTS model |
| `MISTRAL_TTS_VOICE_ID` | empty | Saved Mistral voice profile ID (preferred) |
| `MISTRAL_TTS_VOICE` | empty | Voice slug fallback (if `MISTRAL_TTS_VOICE_ID` is not set) |
| `MISTRAL_TTS_OUTPUT_GAIN` | `2.0` | Backend voice amplification multiplier (applies to all generated TTS audio) |
| `CLOUDINARY_API_SECRET` | empty | Cloudinary secret |

Example:

```env
APP_ENV=development
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
USE_LOCAL_DATABASE=false
LOCAL_DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/mizan_local
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800
DB_POOL_PRE_PING=true
SECRET_KEY=change-me-super-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=

MISTRAL_API_KEY=
MISTRAL_MODEL=mistral-large-latest
MISTRAL_STT_MODEL=voxtral-mini-latest
MISTRAL_STT_LANGUAGE=fr
MISTRAL_REALTIME_MODEL=voxtral-mini-transcribe-realtime-2602
MISTRAL_REALTIME_SAMPLE_RATE=16000
MISTRAL_REALTIME_TARGET_DELAY_MS=700
MISTRAL_REALTIME_SERVER_URL=wss://api.mistral.ai
MISTRAL_TTS_MODEL=voxtral-mini-tts-latest
MISTRAL_TTS_VOICE_ID=
MISTRAL_TTS_VOICE=
MISTRAL_TTS_OUTPUT_GAIN=2.0

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## Database and migrations

- Initial schema: `e5742839ac10_initial_tables.py`
- Voice session schema: `d71384240321_add_voice_session_table.py`

Common commands:

```bash
alembic upgrade head
alembic downgrade -1
alembic revision --autogenerate -m "describe change"
```

> Note: Alembic env converts async URL to a sync `psycopg2` URL for migrations. Ensure sync PostgreSQL driver support is available in your environment.

### Migrate online DB to local DB (no data loss)

1. Install PostgreSQL client tools (`pg_dump`, `pg_restore`).
2. Set both URLs in `.env`:
   - `DATABASE_URL` = current online DB
   - `LOCAL_DATABASE_URL` = local PostgreSQL DB
3. Run:

```bash
python migrate_to_local_postgres.py
```

If your local `pg_dump/pg_restore` client is older than the source server, the script automatically retries with Docker PostgreSQL tools (`postgres:17`). You can override image:

```bash
python migrate_to_local_postgres.py --docker-image postgres:17
```

This script:
- Creates a backup of the source DB (`db_backups/source_*.dump`)
- Creates a safety backup of the local target before overwrite (`db_backups/target_pre_restore_*.dump`)
- Restores source data into local target
- Verifies table row counts source vs target

Then switch runtime to local:

```env
USE_LOCAL_DATABASE=true
```

---

## Auth and access model

- OAuth2 bearer token (`Authorization: Bearer <token>`)
- Roles currently implemented:
  - `ADMIN`
  - `STUDENT`
- Route-level protection uses:
  - `get_current_user`
  - `require_role(Role.ADMIN)`

School-scoped admins are supported using `user.school_id` and enforced in institutional/student/files services.

---

## API modules (high-level)

All routes are mounted under `/api/v1`.

| Router | Prefix | Purpose |
|---|---|---|
| Auth | `/auth` | Activation, login, refresh, password flows |
| Institutional | `/institutional` | Schools, filieres, promotions, classes (admin) |
| Students | `/students` | Student CRUD/import and self context |
| Class Content | `/class-content` | Schedules/exams/projects CRUD + CSV import (admin) |
| Check-ins | `/checkins` | Morning/evening check-ins + history |
| Goals | `/goals` | Goals and progress logging |
| Modes | `/modes` | Start/stop/current/stats mode sessions |
| Analytics | `/analytics` | Student dashboard + admin dashboard |
| Voice | `/voice` | Voice session start/transcribe/submit + realtime websocket |
| Notifications | `/notifications` | REST + realtime notification delivery for autonomous actions |
| Files | `/files` | Student/me photo upload and delete |
| Resources | `/resources` | Wellbeing resources + admin seed |
| Agent | `/agent` | AI context, plan generation, chat |

Use `/docs` for the complete request/response schemas.

---

## CSV import endpoints and expected columns

### Students trombinoscope

- Endpoint: `POST /api/v1/students/import/trombi/{class_id}`
- Parser: `parse_trombi_csv`
- Typical columns: `nom, prenom, email, telephone, cne, photo_url`

### Class schedules

- Endpoint: `POST /api/v1/class-content/{class_id}/schedules/import`
- Parser: `parse_schedule_csv`
- Columns: `subject, day_of_week, start_time, end_time, room, professor`

### Class exams

- Endpoint: `POST /api/v1/class-content/{class_id}/exams/import`
- Parser: `parse_exam_csv`
- Columns: `subject, exam_date, start_time, end_time, room`

### Class projects

- Endpoint: `POST /api/v1/class-content/{class_id}/projects/import`
- Parser: `parse_project_csv`
- Columns: `name, subject, due_date, members` (`members` is comma-separated)

---

## AI and voice behavior

- Agent text planning/chat: Mistral via `app/services/agent_service.py`
- Voice session flow:
  1. `POST /voice/start` creates a voice session + returns guided questions
  2. `POST /voice/transcribe` converts uploaded audio to text (Mistral STT)
  3. `POST /voice/submit` analyzes transcriptions (Mistral JSON output), updates/creates check-in, and marks session analyzed
  4. `WS /voice/realtime` streams PCM audio and receives transcription deltas from Mistral realtime

Voice service enforces:

- valid period (`MORNING`/`EVENING`)
- unique question index per transcription
- minimum transcription count
- morning check-in prerequisite before evening check-in creation

---

## Health endpoints

- `GET /health` -> basic service status
- `GET /api/v1/health/detailed` -> DB connectivity + loaded service list

---

## Autonomous agent loop and realtime notifications

- Autonomous trigger -> decision -> action loop is wired on check-in submissions (including voice check-ins) and chat interactions (`/agent/chat`, `/voice/chat`).
- Agent decisions and runs are persisted in `agent_run` and `agent_decision`.
- Notifications are persisted in `notification` and delivered in realtime.
- Current student-focused autonomous actions include:
  - wellbeing nudge + recovery task creation
  - suggested mode switch (`REVISION` / `EXAMEN` / `PROJET` / `REPOS` ...) + focus task
  - targeted resource auto-delivery + apply-resource micro-task
  - persistent low-mood escalation (high-priority alert + urgent task + follow-up notification)
  - action contracts (accept/decline/complete) with adaptive intensity (`standard`/`gentle`/`micro`)
  - timed contract follow-ups that send reminder notifications when due
  - anti-spam guards: chat-trigger cooldown + recent-similar contract deduplication

Notification endpoints:

- `GET /api/v1/notifications` -> list notifications (`unread_only`, `limit` supported)
- `PATCH /api/v1/notifications/{notification_id}/read` -> mark read/unread
- `WS /api/v1/notifications/ws` -> authenticated realtime stream (query `?token=<jwt>` or `Authorization: Bearer <jwt>`)

Jury/demo visibility endpoints:

- `GET /api/v1/agent/test/runs` -> recent autonomous runs + decisions for current student
- `POST /api/v1/agent/test/trigger` -> manual autonomous trigger for demo
- `GET /api/v1/agent/test/summary` -> quick counts and latest run/notification snapshot
- `POST /api/v1/agent/test/process-followups` -> process due contract follow-ups now (demo helper)
- `POST /api/v1/agent/test/trigger` supports forced scenarios via `event_type`:
  - `FORCE_MODE_SWITCH`
  - `FORCE_RESOURCE_NUDGE`
  - `FORCE_ESCALATION`
  - `FORCE_HIGH_STRESS_EXAM_CRUNCH`
  - `FORCE_HIGH_STRESS_BURNOUT_RISK`
  - `FORCE_HIGH_STRESS_OVERDUE_SPIRAL`
  - `FORCE_AFTER_LUNCH_RESET`
  - `FORCE_CHECKIN_REMINDER`
  - Forced scenario runs bypass notification cooldown and task deduplication to guarantee visible demo outcomes.

Action contract endpoints:

- `GET /api/v1/agent/contracts` -> list contracts (`status`, `limit` supported)
- `POST /api/v1/agent/contracts/{contract_id}/respond` -> accept/decline contract
- `POST /api/v1/agent/contracts/{contract_id}/complete` -> mark contract completed (also completes linked task)

---

## Local development notes

- On startup, default wellbeing resources are seeded when table is empty.
- CORS is currently open (`allow_origins=["*"]`) in `main.py`.
- Focused backend tests exist for autonomous policy behavior in `tests/test_agent_orchestrator.py`.

---

## Quick troubleshooting

- **`Could not validate credentials`**: expired/invalid access token -> refresh via `/auth/refresh`
- **DB migration issues**: verify DB URL + migration driver availability
- **Voice transcription unavailable**: set `MISTRAL_API_KEY` and verify `MISTRAL_STT_MODEL`
- **Voice TTS failures**: set `MISTRAL_API_KEY`, use a valid `MISTRAL_TTS_MODEL`, and prefer `MISTRAL_TTS_VOICE_ID`
- **Photo upload errors**: verify Cloudinary credentials and file type/size limits
