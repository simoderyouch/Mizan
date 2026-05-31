# Mizan — Full deployment guide

Step-by-step guide to deploy **backend**, **web frontend**, and **mobile app** for a demo or production-style run.

| Component | Where it runs | How |
|-----------|---------------|-----|
| Backend (FastAPI) | AWS ECS Fargate + RDS | Docker image in ECR |
| Frontend (Next.js) | AWS ECS Fargate | Docker image in ECR |
| Public URL | CloudFront + ALB | One URL for web **and** API (`/api/v1/...`) |
| Mobile (Expo) | Student phones | **EAS build** (APK/IPA) — **not** deployed to AWS |

Detailed AWS Terraform notes: [infra/aws/README.md](./infra/aws/README.md)

---

## Before you start

### Tools to install

- **Git**
- **Docker** (for local tests and manual AWS image builds)
- **AWS CLI** v2 (if deploying manually)
- **Terraform** ≥ 1.5 (if deploying manually)
- **Node.js** 20 (frontend / mobile checks)
- **Python** 3.12 (backend tests)
- **Expo / EAS CLI** (mobile builds): `npm install -g eas-cli`
- **Expo account** (free): https://expo.dev

### Accounts & keys you need

| Secret | Used for |
|--------|----------|
| AWS access key + secret | Push images, Terraform |
| S3 bucket | Terraform state (one-time) |
| `BACKEND_SECRET_KEY` | JWT (long random string) |
| `MISTRAL_API_KEY` | AI check-ins, agent, voice |
| `CLOUDINARY_*` (optional) | Profile photos |
| `SMTP_USER` / `SMTP_PASSWORD` (optional) | OTP / activation emails |

### Repo layout

```text
mizan/
├── mizan-backend/      # API
├── mizan-frontend/     # Web (admin + student)
├── mizan-mobile-app/   # Expo React Native (students)
├── infra/aws/          # Terraform (AWS)
└── .github/workflows/ci-cd.yml
```

---

## Phase 0 — Preflight on your machine

Run these **before** cloud deploy to catch obvious issues.

### 0.1 Backend tests

```bash
cd mizan-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/mizan_test"
export USE_LOCAL_DATABASE=false
export SECRET_KEY="local-test-secret-key-min-32-chars-long"
export ENABLE_SCHEDULER=false
python -m pytest
```

### 0.2 Frontend build

```bash
cd mizan-frontend
npm ci
npm run lint
NEXT_PUBLIC_API_URL=http://localhost:8000 \
NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/v1/voice/realtime \
npm run build
```

### 0.3 Mobile typecheck

```bash
cd mizan-mobile-app
npm ci
npm run typecheck
```

### 0.4 Optional: full stack locally (Docker)

```bash
cd /path/to/mizan
cp mizan-frontend/.env.local.example mizan-frontend/.env.local
# Create mizan-backend/.env with at least:
#   SECRET_KEY=change-me-in-production
#   MISTRAL_API_KEY=your-key
docker compose up -d --build
```

- Web: http://localhost:3000  
- API: http://localhost:8000/health  
- Mobile (dev): `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8000` in `mizan-mobile-app/.env`

---

## Phase 1 — AWS infrastructure (recommended: GitHub Actions)

### 1.1 Create Terraform state bucket (once)

Pick a **globally unique** bucket name and region (example: `eu-west-3`):

```bash
export AWS_REGION=eu-west-3
export TF_STATE_BUCKET=mizan-tf-state-YOURNAME-UNIQUE

aws s3 mb "s3://${TF_STATE_BUCKET}" --region "${AWS_REGION}"
aws s3api put-bucket-versioning \
  --bucket "${TF_STATE_BUCKET}" \
  --region "${AWS_REGION}" \
  --versioning-configuration Status=Enabled
```

### 1.2 GitHub repository secrets

In GitHub: **Settings → Secrets and variables → Actions → Secrets**

**Required for deploy:**

| Secret | Example / notes |
|--------|------------------|
| `AWS_DEPLOY_ENABLED` | `true` |
| `AWS_ACCESS_KEY_ID` | IAM user with ECR, ECS, RDS, CloudFront, S3, Secrets Manager |
| `AWS_SECRET_ACCESS_KEY` | |
| `AWS_REGION` | `eu-west-3` |
| `TF_STATE_BUCKET` | Same as `TF_STATE_BUCKET` above |
| `TF_STATE_KEY` | `mizan/demo/terraform.tfstate` |
| `TF_STATE_REGION` | Same as `AWS_REGION` (optional if same) |

**Strongly recommended:**

| Secret | Notes |
|--------|--------|
| `BACKEND_SECRET_KEY` | 32+ random characters |
| `MISTRAL_API_KEY` | Required for agent + personalized check-ins |

**Custom domain (optional):**

| Secret | Example |
|--------|---------|
| `APP_PUBLIC_URL` | `https://mizan.yourdomain.com` |

When set, Terraform requests an ACM certificate (us-east-1), attaches it to CloudFront, rebuilds the frontend with your URL, and prints Namecheap CNAME records in the deploy log. CI health checks use the CloudFront hostname until DNS propagates.

Demo data is seeded automatically on first backend startup (`SEED_DEMO_DATA=true` by default): school ENSET, admin accounts, and student personas. Password for all demo users: `Mizan@2026!` (see `login_info.txt`).

**Optional:**

| Secret | Notes |
|--------|--------|
| `CLOUDINARY_CLOUD_NAME` | |
| `CLOUDINARY_API_KEY` | |
| `CLOUDINARY_API_SECRET` | |
| `SMTP_USER` | |
| `SMTP_PASSWORD` | |

Optional **Variables** (not secrets): `PROJECT_NAME=mizan`, `DEPLOY_ENVIRONMENT=demo`

### 1.3 Deploy via GitHub Actions

1. Push your code to `main` on GitHub, **or**
2. **Actions → CI/CD → Run workflow**
   - `aws_action`: **deploy**

The workflow will:

1. Run backend tests and frontend build  
2. Create ECR repos, push backend image  
3. Apply Terraform (ECS, RDS, ALB, CloudFront, secrets)  
4. Rebuild frontend with the real public URL  
5. Invalidate CloudFront  
6. Call `/health`

Watch the job **Deploy AWS** until it finishes. Note the step **Show deployment URLs**.

### 1.4 Get your public URLs

From the workflow log, or locally after Terraform:

```bash
cd infra/aws
terraform init \
  -backend-config="bucket=${TF_STATE_BUCKET}" \
  -backend-config="key=mizan/demo/terraform.tfstate" \
  -backend-config="region=${AWS_REGION}"

terraform output app_url
terraform output api_health_url
```

You will get something like:

- **App / Web:** `https://d1234abcd.cloudfront.net`  
- **Health:** `https://d1234abcd.cloudfront.net/health`

Use **one origin** for both web and API. The mobile app uses the same base URL (no `/api/v1` suffix).

---

## Phase 1 (alternative) — Manual AWS deploy

If you cannot use GitHub Actions, follow the exact sequence in [infra/aws/README.md](./infra/aws/README.md) (bootstrap frontend image → apply → rebuild frontend with `app_url` → apply again → invalidate CloudFront).

---

## Phase 2 — Verify web deployment

1. Open `terraform output app_url` in a browser.  
2. Check health: `curl -fsS "$(terraform output -raw api_health_url)"`  
   - Expect JSON with `"status":"ok"` and database connected.  
3. Log in:
   - Admin: see root [README.md](./README.md) or `login_info.txt` for demo accounts  
   - Student: e.g. `yassine@enset.ma` / `Mizan@2026!`  
4. Admin: add an exam or project with a **near deadline** → student should get notifications + agent task.  
5. Student web: **Agent chat**, **Tasks**, **Notifications**.

### Web env reminder

Production frontend is baked at **build time**:

- `NEXT_PUBLIC_API_URL` = your CloudFront URL  
- `NEXT_PUBLIC_WS_URL` = `wss://<same-host>/api/v1/voice/realtime`

The CI workflow sets these automatically on the second frontend build.

---

## Phase 3 — Mobile app (Expo EAS)

The mobile app does **not** go to ECS. You build an **APK** (Android) or **IPA** (iOS) and install it on demo phones.

### 3.1 Set production API URL

After Phase 1, copy your public app URL (CloudFront), e.g. `https://d1234abcd.cloudfront.net`.

**Option A — EAS environment (recommended for builds)**

```bash
cd mizan-mobile-app
eas login
eas env:create --name EXPO_PUBLIC_API_URL --value "https://YOUR-CLOUDFRONT-URL" --environment production --visibility plaintext
```

**Option B — local file for one-off build**

```bash
cd mizan-mobile-app
cp .env.example .env
# Edit .env — API origin only, NO /api/v1:
EXPO_PUBLIC_API_URL=https://YOUR-CLOUDFRONT-URL
```

### 3.2 Configure EAS project (first time only)

```bash
cd mizan-mobile-app
npm ci
eas login
eas build:configure
```

`app.json` already contains an EAS `projectId`. If EAS asks to link the project, accept linking to your Expo account.

### 3.3 Build Android APK (demo / internal distribution)

```bash
cd mizan-mobile-app
eas build --platform android --profile preview
```

When the build finishes, Expo gives a **download link** for the `.apk`. Install on the phone (enable “install unknown apps” if needed).

For a store-ready build later:

```bash
eas build --platform android --profile production
```

### 3.4 Build iOS (optional, needs Apple Developer account)

```bash
eas build --platform ios --profile preview
```

Install via TestFlight or internal distribution.

### 3.5 Development client (engineering only)

For day-to-day coding with hot reload:

```bash
cd mizan-mobile-app
cp .env.example .env
# LAN IP for physical device, or 10.0.2.2:8000 for Android emulator
EXPO_PUBLIC_API_URL=http://192.168.1.XX:8000
npm start
```

Use **development** profile only if you already installed a dev client:

```bash
eas build --profile development --platform android
```

### 3.6 Verify mobile against production

On the phone (production API URL configured):

1. Open Mizan → log in as student.  
2. **More** tab → Backend card should show **Connected** and your HTTPS URL.  
3. **Rituel** → morning/evening check-in.  
4. **Mizan AI** → send a message → check **Notifications** and **Tasks** if agent acted.  
5. Microphone: allow permission for voice check-in / voice chat.

**Do not use `localhost` on a physical phone** — it points to the phone itself, not your server.

---

## Phase 4 — Demo day checklist

| Step | Done |
|------|------|
| CloudFront URL opens web app | ☐ |
| `/health` OK | ☐ |
| `MISTRAL_API_KEY` set in AWS secrets | ☐ |
| Admin can add class content | ☐ |
| Student web login works | ☐ |
| Mobile APK installed with same API URL | ☐ |
| Mobile “Backend: Connected” on More screen | ☐ |
| One live agent action visible (task + notification) | ☐ |

---

## Tear down AWS (after demo)

**GitHub Actions → CI/CD → Run workflow → `aws_action`: destroy**

Or locally:

```bash
cd infra/aws
terraform destroy
```

CloudFront removal can take several minutes. This deletes ECS, RDS, ALB, ECR repos (if configured), etc.

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| Frontend loads, API 404 | `NEXT_PUBLIC_API_URL` must be CloudFront origin; rebuild frontend image after URL is known |
| CORS errors in browser | Terraform sets `BACKEND_CORS_ORIGINS` to public origin; redeploy if you changed URL |
| Mobile “Backend: Offline” | `EXPO_PUBLIC_API_URL` must be `https://...` CloudFront URL; phone needs internet |
| Generic check-in questions | `MISTRAL_API_KEY` empty on backend → set secret and redeploy ECS |
| No agent tasks on chat | Same Mistral key; check backend logs on CloudWatch |
| WS errors in logs on tab close | Harmless client disconnect; optional fix in `STUDENT_APP_PLAN.md` |
| GitHub deploy skipped | `AWS_DEPLOY_ENABLED` must be exactly `true` |
| Terraform state lock | Wait or fix S3/Dynamo lock; don’t run two deploys at once |

### Useful commands

```bash
# Backend logs (replace cluster/service from terraform output)
aws logs tail /ecs/mizan-demo-backend --follow --region eu-west-3

# Force CloudFront refresh after frontend rebuild
aws cloudfront create-invalidation \
  --distribution-id "$(cd infra/aws && terraform output -raw cloudfront_distribution_id)" \
  --paths "/*"
```

---

## What is *not* in this deploy

- **Teachers role** — content UI is admin-only for now (presentation OK).  
- **App Store / Play Store listing** — use EAS `production` + store submission separately.  
- **mizan-frontend-pwa** — local dev only, not deployed.

---

## Quick reference

```bash
# Local checks
cd mizan-backend && pytest
cd mizan-frontend && npm run build
cd mizan-mobile-app && npm run typecheck

# Mobile production build
cd mizan-mobile-app
eas build --platform android --profile preview

# Public URLs (after Terraform)
cd infra/aws && terraform output app_url && terraform output api_health_url
```

For questions about AWS resource sizing and cost, see [infra/aws/README.md](./infra/aws/README.md).
