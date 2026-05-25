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
- Docker Compose remains available for local/server-style testing.
- CI/CD workflow exists at `.github/workflows/ci-cd.yml`.
- AWS Terraform stack exists for ECS Fargate, RDS PostgreSQL, ALB, CloudFront, ECR, Secrets Manager, and CloudWatch.

## Required Real Values Before Public Deploy

For AWS deploy, set these as GitHub Actions secrets or Terraform variables. Do not commit them.

```text
AWS_DEPLOY_ENABLED=true
AWS_ACCESS_KEY_ID=<access-key>
AWS_SECRET_ACCESS_KEY=<secret-key>
AWS_REGION=eu-west-3
TF_STATE_BUCKET=<terraform-state-bucket>
TF_STATE_KEY=mizan/demo/terraform.tfstate
BACKEND_SECRET_KEY=<long-random-secret>
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

Deploy runs on pushes to `main`, after CI passes, when `AWS_DEPLOY_ENABLED=true`.

Add these GitHub repository secrets before enabling automatic deploy:

```text
AWS_DEPLOY_ENABLED=true
AWS_ACCESS_KEY_ID=<access-key>
AWS_SECRET_ACCESS_KEY=<secret-key>
AWS_REGION=eu-west-3
TF_STATE_BUCKET=<terraform-state-bucket>
TF_STATE_KEY=mizan/demo/terraform.tfstate
```

If deploy secrets are missing, CI still runs and the AWS deploy job safely skips deployment.

## Deploy Commands

```text
GitHub -> Actions -> CI/CD -> Run workflow -> aws_action=deploy
GitHub -> Actions -> CI/CD -> Run workflow -> aws_action=destroy
```

## Go / No-Go

Deploy is a GO only if all are true:

- `SECRET_KEY` is strong and not default.
- Public access uses HTTPS.
- `BACKEND_CORS_ORIGINS` contains only the real frontend domains.
- Database and backend ports are not open publicly.
- `alembic upgrade head` succeeds.
- Backend tests pass.
- File uploads are size/type limited.
- Scheduler is not duplicated across multiple backend containers.
- AWS budget alerts exist.
- Destroy workflow has been tested before the real demo.
- Backup and restore test has been done.

Deploy is a NO-GO if any are true:

- `SECRET_KEY=change-me-in-production`.
- API is exposed over plain HTTP only.
- Postgres port `5432` is open to the internet.
- Backend port `8000` is open to the internet directly.
- CORS allows `*` in production.
- Migrations fail.
