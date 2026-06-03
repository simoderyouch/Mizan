# Sample data (staging & demos)

Synthetic dataset for **staging**, **video demos**, and **local Docker** — not for production with real students.

## When it runs

| Method | Behavior |
|--------|----------|
| **GitHub Actions (push to `main`)** | Enable repo variable + secret below — runs after each deploy |
| **ECS backend startup** | Same flags in Secrets Manager (`SEED_SAMPLE_DATA` on empty DB) |
| **Manual** | `./scripts/seed-sample-data.sh` |
| **Docker Compose** | `SEED_SAMPLE_DATA=true` + `SAMPLE_DATA_PASSWORD` in backend env |

**Guard:** If the database already has users, seeding is **skipped** (no overwrite).

### Auto-seed on push (GitHub)

In the repository:

1. **Settings → Secrets and variables → Actions → Variables**  
   - `SEED_SAMPLE_DATA_ENABLED` = `true`

2. **Settings → Secrets and variables → Actions → Secrets**  
   - `SAMPLE_DATA_PASSWORD` = your staging password (min 8 characters)

On the next deploy workflow, CI will:

- Pass these into Terraform (backend task env in Secrets Manager)
- Run a one-off ECS task inside the VPC to execute `seed_sample_database.py` after `/health` is OK

Disable by setting `SEED_SAMPLE_DATA_ENABLED` to `false` or removing the secret.

## Prerequisites

```bash
export DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/mizan"
export SAMPLE_DATA_PASSWORD="YourStagingPassword8+"
```

Use a password you are comfortable sharing with reviewers on **staging only**. Never use this on production with real personal data.

## What gets created

| Entity | Content |
|--------|---------|
| School | ENSET Mohammedia (verified) |
| Structure | 2 filières, promotions, 2 classes |
| Admins | Global + school admin |
| Students | 3 personas (see below) |
| Per student | 7 days morning/evening check-ins, goals + progress, weekly schedule, exams, projects, tasks |
| Extras | Sample notifications (stressed student), mode session (thriving student) |
| Resources | Default wellbeing catalog (if missing) |

## Login accounts

All accounts use **`MizanStaging2026`**.

| Email | Role | Persona |
|-------|------|---------|
| `admin@mizan.ai` | Global admin | Platform operator |
| `admin@enset.ma` | School admin | ENSET Mohammedia |
| `nizar@enset.ma` | Student | Exam pressure, low mood, poor sleep |
| `yassine@enset.ma` | Student | Stable week, high completion |
| `meriem@enset.ma` | Student | Burnout → recovery arc over 7 days |

## Scenarios to demo

1. **Nizar** — Open dashboard: low mood trend, exam tomorrow notification, pending agent task.
2. **Yassine** — Balanced analytics, completed plans, revision mode history.
3. **Meriem** — Mood graph climbing over the week; good for weekly report.
4. **School admin** — Class structure, student list, schedules already populated per student.

## After AWS deploy

1. Wait for `/health` OK and migrations.
2. From a machine with network access to RDS (VPN/bastion/tunnel) or run a one-off ECS task:

```bash
export DATABASE_URL="<from Secrets Manager / terraform>"
export SAMPLE_DATA_PASSWORD="<staging password>"
./scripts/seed-sample-data.sh
```

3. Log in on the CloudFront URL with any account above.

## Production warning

Do **not** enable `SEED_SAMPLE_DATA` or run this script on production environments that will hold real student data. Use normal onboarding (`create_global_admin.py`, school registration, CSV import) instead.
