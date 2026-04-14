# Mizan Jury Deployment (All-in-One Docker Compose on AWS)

This guide deploys the full project in one stack:

- `mizan-backend` (FastAPI)
- `mizan-frontend` (web)
- `mizan-frontend-mobile` (mobile web UI)
- `postgres` (database)

It is optimized for **competition/jury demo speed**, not for large-scale production.

---

## 1. Files added for this deployment

At repo root:
- `docker-compose.yml`
- `.env.compose.example`

Per app:
- `mizan-backend/Dockerfile`
- `mizan-backend/docker/entrypoint.sh`
- `mizan-backend/.dockerignore`
- `mizan-frontend/Dockerfile`
- `mizan-frontend/.dockerignore`
- `mizan-frontend-mobile/Dockerfile`
- `mizan-frontend-mobile/.dockerignore`

---

## 2. First-time EC2 configuration (detailed)

### 2.1 Launch EC2 instance

Use these recommended settings:

- **AMI**: Ubuntu Server 22.04 LTS (or 24.04)
- **Instance type**: `t3.medium` minimum (2 vCPU, 4 GB RAM)
- **Storage**: 30 GB `gp3`
- **Auto-assign public IP**: enabled
- **Key pair**: create/download a `.pem` key

### 2.2 Security Group inbound rules

Configure inbound exactly like this:

- `22` (SSH) -> source: **your IP only** (recommended)
- `80` (HTTP) -> source: `0.0.0.0/0` (for SSL challenge and redirect)
- `443` (HTTPS) -> source: `0.0.0.0/0` (main entry point)

Keep app ports and database private:
- Do **not** open `3000`, `3001`, `8000` or `5432` publicly. They are handled by Nginx internally.

### 2.3 Connect to instance

From your local machine:

```bash
chmod 400 <your-key>.pem
ssh -i <your-key>.pem ubuntu@<EC2_PUBLIC_IP>
```

### 2.4 Install Docker, Compose plugin, and Git

Run on EC2:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

### 2.5 Optional but recommended

```bash
sudo timedatectl set-timezone UTC
sudo apt-get install -y htop
```

---

## 3. Clone project and prepare environment

```bash
git clone <YOUR_REPO_URL>
cd mizan
cp .env.compose.example .env.compose
```

Edit `.env.compose`:

```bash
nano .env.compose
```

Minimum values to set:
- `SECRET_KEY`
- `MISTRAL_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `DOMAIN` (e.g., `mizan.your-domain.com`)
- `EMAIL` (for Certbot SSL alerts)

If you keep defaults, internal DB works with:
- `POSTGRES_DB=mizan`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=postgres`

### 3.1 Initialize Docker DB from your local data (first start)

This stack now supports automatic seed restore for Postgres on first initialization.

How it works:
- `docker/postgres/init/20-seed-restore.sh` runs only when Postgres volume is empty.
- If `/seed/${DB_SEED_FILE}` exists, it restores it automatically.
- Supported formats: `.dump`, `.sql`, `.sql.gz`

Default env values:
- `DB_AUTO_SEED=true`
- `DB_SEED_FILE=local.dump`

Place your seed file here before first `docker compose up`:

```bash
mkdir -p docker/postgres/seed
cp <your_local_dump_file>.dump docker/postgres/seed/local.dump
```

If you already have local dumps in this repo:

```bash
cp mizan-backend/db_backups/source_*.dump docker/postgres/seed/local.dump
```

Or create a fresh local dump:

```bash
pg_dump -Fc -h 127.0.0.1 -U postgres -d mizan_local -f docker/postgres/seed/local.dump
```

Important:
- Restore runs only on first DB init (empty Docker volume).
- If DB was already initialized and you want to re-seed, reset volume:

```bash
docker compose down -v
docker compose --env-file .env.compose up -d --build
```

### 3.2 DNS Configuration (For Vercel Portfolio Users)

If your main domain (e.g. `yourdomain.com`) is already pointing to **Vercel**, you can still use **Mizan subdomains** on EC2 without breaking your portfolio.

1. **Find your EC2 Public IP**: In AWS Console -> Copy "Public IPv4 address".
2. **Login to Namecheap** -> Advanced DNS.
3. **Add ONLY these A records** (Do NOT change `@` or `www` if Vercel uses them):
   - **Type**: `A Record` | **Host**: `mizan` | **Value**: `<EC2_PUBLIC_IP>`
   - **Type**: `A Record` | **Host**: `mizanm` | **Value**: `<EC2_PUBLIC_IP>`
   - **Type**: `A Record` | **Host**: `api` | **Value**: `<EC2_PUBLIC_IP>`
4. **Wait**: DNS propagation is usually fast for new subdomains.

---

### 4. SSL / HTTPS Setup (Recommended)

To deploy with SSL (HTTPS) using Let's Encrypt:

1. **Verify your domain** is pointing to the EC2 Public IP.
2. **Update `.env.compose`**:
   ```env
   DOMAIN=your-domain.com
   EMAIL=your-email@example.com
   NEXT_PUBLIC_API_URL=https://api.your-domain.com
   NEXT_PUBLIC_WS_URL=wss://api.your-domain.com/ws
   ```
3. **Initialize SSL**:
   Run the automated script once:
   ```bash
   ./docker/nginx/init-ssl.sh
   ```
   This script will:
   - Prepare Nginx configurations.
   - Obtain Let's Encrypt certificates.
   - Start the Nginx reverse proxy.

---

## 5. Important public URL values (for jury access)

If you use the SSL setup (Step 4), your URLs will be:

```env
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_WS_URL=wss://api.your-domain.com/ws
```

Otherwise, if you stay on HTTP (not recommended):

```env
NEXT_PUBLIC_API_URL=http://<EC2_PUBLIC_IP>:8000
NEXT_PUBLIC_WS_URL=ws://<EC2_PUBLIC_IP>:8000/ws
```

---

## 5. Run the full stack

Build and start:

```bash
docker compose --env-file .env.compose up -d --build
```

Check status:

```bash
docker compose ps
docker compose logs -f backend
```

Backend entrypoint waits for Postgres, runs Alembic migrations, then starts API.

---

## 6. Jury demo URLs

Using EC2 public IP:

- Frontend web: `https://mizan.<DOMAIN>` (and `https://<DOMAIN>`)
- Frontend mobile web: `https://mizanm.<DOMAIN>`
- Backend health: `https://api.<DOMAIN>/health`
- Backend docs: `https://api.<DOMAIN>/docs`

---

## 7. Common operations

Update after new code:

```bash
git pull
docker compose --env-file .env.compose up -d --build
```

Restart:

```bash
docker compose restart
```

Stop:

```bash
docker compose down
```

Stop and remove DB volume (danger: data loss):

```bash
docker compose down -v
```

---

## 8. Optional simple GitHub -> AWS auto-deploy (compose)

If you still want a basic pipeline:

1. Keep this same Compose setup on EC2.
2. Use GitHub Actions to SSH into EC2 and run:
   - `git pull`
   - `docker compose --env-file .env.compose up -d --build`

You will need GitHub repository secrets:
- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_PRIVATE_KEY`
- `EC2_APP_PATH` (example: `/home/ubuntu/mizan`)

---

## 9. Troubleshooting

Frontend cannot reach backend:
- Verify `NEXT_PUBLIC_API_URL` in `.env.compose`
- Rebuild frontend containers after changing it:
  ```bash
  docker compose --env-file .env.compose up -d --build frontend frontend-mobile
  ```

Backend crash at startup:
- Check logs:
  ```bash
  docker compose logs -f backend
  ```
- Ensure required env values exist (`SECRET_KEY`, provider keys)

Database connection issues:
- Ensure `db` container is healthy:
  ```bash
  docker compose ps
  docker compose logs -f db
  ```

---

## 10. Recommended demo mode

For jury stability:
1. Deploy this stack at least once before presentation day
2. Seed realistic demo data
3. Keep one terminal with `docker compose logs -f backend` for quick diagnosis
4. Do not change env vars right before the demo unless necessary
