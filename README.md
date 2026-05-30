# Mizan Platform

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

Production-style demo deployment uses AWS with:

- frontend Docker image on ECS Fargate
- backend Docker image on ECS Fargate
- PostgreSQL on private RDS
- Application Load Balancer and CloudFront
- Secrets Manager, ECR, and CloudWatch

Read the full step-by-step deployment guide (AWS web + mobile EAS):

**[DEPLOYMENT_README.md](./DEPLOYMENT_README.md)**

## CI/CD

GitHub Actions workflow:

```text
.github/workflows/ci-cd.yml
```

The workflow runs backend tests, frontend build checks, mobile typecheck, and deploys to AWS after pushes to `main` when `AWS_DEPLOY_ENABLED=true`. It also has a manual destroy action for shutting the demo stack down.

## Security

Do not commit:

- `.env`
- `.env.compose`
- database dumps
- cloud provider credentials
- private SSH keys

Production requires strong `SECRET_KEY`, HTTPS, restricted CORS, private database access, budget alerts, and a tested destroy/backup plan.


## 1. Super Admin Account
## Email: admin@mizan.ai
## Password: Mizan@2026!
## Role: ADMIN
## 2. Standard Admin Account (School Admin)
## Email: admin@mizanmail.com
## Password: Mizan@2026!
## Role: ADMIN
## 3. Student Account
## Email: student001@mizanmail.com
## Password: Mizan@2026!
## Role: STUDENT
