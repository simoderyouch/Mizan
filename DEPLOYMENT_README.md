# Mizan Production Deployment Guide

This guide describes the real production deployment path for Mizan.

The deployed stack is:

- `mizan-backend`: FastAPI API
- `mizan-frontend`: Next.js web app
- `postgres`: PostgreSQL database
- `nginx`: HTTPS reverse proxy
- `certbot`: Let's Encrypt renewal

The local-only development/test PWA folder is not deployed and is ignored by git.

## What You Need To Provide

### 1. Domain

You need a domain you control, for example:

```text
example.com
```

Create DNS records after the server exists:

```text
A  mizan  <SERVER_PUBLIC_IP>
A  api    <SERVER_PUBLIC_IP>
```

Do not create or use `mizanm` for production; the PWA is local/dev-test only.

### 2. Server

Main target: AWS EC2 free tier where possible.

Recommended AWS instance:

```text
AMI: Ubuntu Server 22.04 LTS or 24.04 LTS
Instance type: t2.micro or t3.micro for free-tier style testing
Storage: 20-30 GB gp3
Security group:
  22  your IP only
  80  0.0.0.0/0
  443 0.0.0.0/0
```

Important: EC2 free tier eligibility depends on your AWS account. GitHub Actions cannot create an AWS instance unless you provide AWS credentials and accept possible billing.

### 3. Secrets

Create a local `.env.compose` file on your machine or on the server. Do not commit it.

Minimum required production values:

```env
DOMAIN=example.com
EMAIL=you@example.com

APP_ENV=production
POSTGRES_DB=mizan
POSTGRES_USER=mizan
POSTGRES_PASSWORD=<strong-db-password>
SECRET_KEY=<long-random-secret>

BACKEND_CORS_ORIGINS=https://mizan.example.com
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_WS_URL=wss://api.example.com/api/v1/voice/realtime
```

Optional but needed for full functionality:

```env
MISTRAL_API_KEY=<mistral-key>
CLOUDINARY_CLOUD_NAME=<cloudinary-name>
CLOUDINARY_API_KEY=<cloudinary-key>
CLOUDINARY_API_SECRET=<cloudinary-secret>
SMTP_USER=<smtp-user>
SMTP_PASSWORD=<smtp-password>
```

Generate a strong secret:

```bash
python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(64))
PY
```

## Manual AWS EC2 Setup

SSH into the server:

```bash
ssh -i <your-key>.pem ubuntu@<SERVER_PUBLIC_IP>
```

Install Docker and Git:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

Clone the repository:

```bash
git clone https://github.com/<OWNER>/<REPO>.git ~/mizan
cd ~/mizan
```

Create `.env.compose`:

```bash
cp .env.compose.example .env.compose
nano .env.compose
```

Build and start:

```bash
docker compose --env-file .env.compose up -d --build
docker compose --env-file .env.compose ps
docker compose --env-file .env.compose logs -f backend
```

Initialize HTTPS after DNS points to the server:

```bash
./docker/nginx/init-ssl.sh
```

Check:

```bash
curl -fsS https://api.example.com/health
curl -fsS https://api.example.com/api/v1/health/detailed
```

## GitHub Actions CI/CD

The workflow file is:

```text
.github/workflows/ci-cd.yml
```

It runs:

- backend tests
- frontend lint/build
- mobile typecheck
- deploy to the server after push to `main`, only if deploy secrets exist

Add these GitHub repository secrets:

```text
DEPLOY_HOST=<server-public-ip-or-domain>
DEPLOY_USER=ubuntu
DEPLOY_PORT=22
DEPLOY_PATH=/home/ubuntu/mizan
DEPLOY_SSH_KEY=<private key that can SSH into the server>
ENV_COMPOSE_BASE64=<base64 of .env.compose>
DEPLOY_HEALTH_URL=https://api.example.com/health
```

Create `ENV_COMPOSE_BASE64` locally:

```bash
base64 -w 0 .env.compose
```

If deploy secrets are missing, CI passes but deployment is skipped.

## Optional: AWS Instance Creation With Terraform

Terraform files are available in:

```text
infra/aws/
```

You can run Terraform locally, or trigger the GitHub Actions workflow manually with `provision_aws=true`.

Instance creation needs your AWS credentials and billing approval.

You would need to provide:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_SSH_PUBLIC_KEY
AWS_SSH_ALLOWED_CIDR
```

Recommended GitHub secret values:

```text
AWS_REGION=eu-west-3
AWS_SSH_PUBLIC_KEY=<contents of your public SSH key>
AWS_SSH_ALLOWED_CIDR=<your-public-ip>/32
```

Manual EC2 creation is still recommended if you want the strongest control over free-tier limits and costs.

## Backup

Create a backup:

```bash
docker compose --env-file .env.compose exec db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/mizan_backup.dump
docker cp mizan-db:/tmp/mizan_backup.dump ./mizan_backup.dump
```

Verify backup:

```bash
pg_restore --list ./mizan_backup.dump >/dev/null
```

## Production Go / No-Go

Go only if:

- `SECRET_KEY` is strong and not default
- `POSTGRES_PASSWORD` is strong and not default
- DNS points to the server
- HTTPS is working
- backend health is reachable
- detailed health reports database connected
- GitHub Actions CI passes
- database backup has been tested
