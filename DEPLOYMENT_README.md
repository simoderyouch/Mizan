# Mizan AWS Deployment Guide

This is the recommended production-style deployment for the demo.

The deployed stack is split:

- `mizan-frontend`: Next.js Docker container on ECS Fargate
- `mizan-backend`: FastAPI Docker container on ECS Fargate
- `postgres`: private RDS PostgreSQL
- `alb`: Application Load Balancer routing frontend and API traffic
- `CloudFront`: HTTPS public entry point in front of the ALB
- `Secrets Manager`: backend environment and provider secrets
- `ECR`: frontend and backend Docker image registry
- `CloudWatch`: frontend and backend logs

The local-only PWA folder is not deployed and is ignored by git.

## Best Demo Strategy

For your plan, use the AWS stack only around the demo:

1. Create the Terraform state bucket once.
2. Add GitHub secrets.
3. Run the deploy workflow the day before the demo.
4. Test login, API health, AI/upload features, and frontend navigation.
5. Run the demo.
6. Run the destroy workflow immediately after.

The Terraform defaults are intentionally demo-friendly: one frontend task, one backend task, small RDS, no NAT Gateway, no multi-AZ database, and easy teardown.

## What You Need To Provide

### 1. AWS Account

Use an AWS account with billing alerts enabled. If you are using the AWS `$100` Free Tier credit, this stack should be reasonable for a short run, but AWS can still charge you if usage exceeds credits or if credits do not apply to a service.

Create budget alerts before deploying:

```text
$20 alert
$50 alert
$90 alert
```

### 2. AWS IAM Credentials

For GitHub Actions, provide IAM credentials with permission to manage:

```text
ECR
ECS
Fargate
RDS
EC2 security groups/load balancers
CloudFront
Secrets Manager
CloudWatch Logs
IAM roles/policies
Terraform state S3 bucket access
```

For a quick demo, an admin-level temporary IAM user is simpler. For long-term production, use GitHub OIDC and least-privilege IAM.

### 3. Terraform State Bucket

Create one S3 bucket for Terraform state:

```bash
aws s3 mb s3://<unique-tf-state-bucket> --region eu-west-3
aws s3api put-bucket-versioning \
  --bucket <unique-tf-state-bucket> \
  --versioning-configuration Status=Enabled
```

Keep this bucket after the demo if you may redeploy later. If you delete it, Terraform loses the map of what it created.

### 4. GitHub Secrets

Required for AWS deploy:

```text
AWS_DEPLOY_ENABLED=true
AWS_ACCESS_KEY_ID=<access-key>
AWS_SECRET_ACCESS_KEY=<secret-key>
AWS_REGION=eu-west-3
TF_STATE_BUCKET=<unique-tf-state-bucket>
TF_STATE_KEY=mizan/demo/terraform.tfstate
```

Recommended backend secret:

```text
BACKEND_SECRET_KEY=<long-random-secret>
```

Generate it locally:

```bash
python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(64))
PY
```

Optional feature secrets:

```text
MISTRAL_API_KEY=<mistral-key>
CLOUDINARY_CLOUD_NAME=<cloudinary-name>
CLOUDINARY_API_KEY=<cloudinary-key>
CLOUDINARY_API_SECRET=<cloudinary-secret>
SMTP_USER=<smtp-user>
SMTP_PASSWORD=<smtp-password>
```

If optional provider secrets are missing, the base app can deploy, but related AI/upload/email features may not work.

## GitHub Actions CI/CD

Workflow:

```text
.github/workflows/ci-cd.yml
```

It runs:

- backend tests
- frontend lint/build
- mobile typecheck
- AWS deploy on push to `main`, only when `AWS_DEPLOY_ENABLED=true`
- manual AWS deploy/destroy through `workflow_dispatch`

Manual deploy:

```text
GitHub -> Actions -> CI/CD -> Run workflow -> aws_action=deploy
```

Manual destroy:

```text
GitHub -> Actions -> CI/CD -> Run workflow -> aws_action=destroy
```

## What Deploy Does

The deploy job:

1. Creates the frontend and backend ECR repositories if needed.
2. Builds `mizan-backend/Dockerfile`.
3. Pushes the backend image to ECR using the commit SHA tag.
4. Builds a bootstrap `mizan-frontend/Dockerfile` image.
5. Applies Terraform for ECS, RDS, ALB, CloudFront, secrets, IAM, and logs.
6. Reads the deployed CloudFront URL from Terraform output.
7. Rebuilds the frontend image with the deployed API/WebSocket URLs.
8. Applies Terraform again to switch ECS to the final frontend image.
9. Invalidates CloudFront.
10. Calls the backend `/health` endpoint.

## Public URLs

Terraform outputs the URLs:

```bash
cd infra/aws
terraform output app_url
terraform output frontend_url
terraform output api_url
terraform output api_health_url
```

For the first demo version, use the generated CloudFront domain directly. A custom domain can be added later with Route 53 and ACM.

## Routing

CloudFront sends traffic to the ALB.

The ALB routes:

```text
/api/v1/*      -> backend ECS service
/health        -> backend ECS service
/docs          -> backend ECS service
/openapi.json  -> backend ECS service
everything else -> frontend ECS service
```

## Shutdown After Demo

Preferred:

```text
GitHub -> Actions -> CI/CD -> Run workflow -> aws_action=destroy
```

Local:

```bash
cd infra/aws
terraform destroy
```

CloudFront deletion can take several minutes. Wait until destroy finishes before assuming billing has stopped.

## Go / No-Go Checklist

Go only if:

- GitHub Actions checks pass
- AWS deploy job completes successfully
- frontend URL opens
- API health URL returns success
- login works
- detailed health shows database connected
- Mistral/Cloudinary features are tested if used in the demo
- budget alerts exist
- destroy workflow has been tested once before the real demo day
