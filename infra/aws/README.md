# AWS Split Deployment

This Terraform stack creates the production-style demo architecture for Mizan:

- Frontend: Next.js Docker container on ECS Fargate
- Backend: FastAPI Docker container on ECS Fargate
- Database: private RDS PostgreSQL
- Public entry: CloudFront over an Application Load Balancer
- Routing: ALB sends `/api/v1/*`, `/health`, `/docs`, and `/openapi.json` to the backend; all other paths go to the frontend
- Secrets: AWS Secrets Manager
- Images: Amazon ECR
- Logs: CloudWatch Logs

It is designed for a short demo run. Defaults favor easy teardown and controlled cost.

## Cost Controls

The defaults are intentionally small:

- one ECS Fargate frontend task
- one ECS Fargate backend task
- one `db.t4g.micro` RDS instance
- no NAT Gateway
- no multi-AZ database
- CloudFront `PriceClass_100`
- ECR force-delete enabled
- RDS final snapshot skipped by default

For the day-before-demo plan, apply the stack, test it, run the demo, then destroy it.

## Local Usage

The GitHub Actions workflow is the cleanest deploy path because the frontend image needs the final CloudFront URL at build time. For local deploys, use this sequence:

```bash
cd infra/aws
terraform init
terraform apply -target=aws_ecr_repository.backend -target=aws_ecr_repository.frontend

BACKEND_ECR="$(terraform output -raw backend_ecr_repository_url)"
FRONTEND_ECR="$(terraform output -raw frontend_ecr_repository_url)"
aws ecr get-login-password --region eu-west-3 | docker login --username AWS --password-stdin "${BACKEND_ECR%/*}"

docker build -t "$BACKEND_ECR:local" ../../mizan-backend
docker push "$BACKEND_ECR:local"

docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 \
  --build-arg NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/v1/voice/realtime \
  -t "$FRONTEND_ECR:bootstrap" \
  ../../mizan-frontend
docker push "$FRONTEND_ECR:bootstrap"

terraform apply \
  -var="backend_image_tag=local" \
  -var="frontend_image_tag=bootstrap"
```

Then rebuild the frontend with the real CloudFront URL:

```bash
APP_URL="$(terraform output -raw app_url)"
docker build \
  --build-arg NEXT_PUBLIC_API_URL="$APP_URL" \
  --build-arg NEXT_PUBLIC_WS_URL="${APP_URL/https:/wss:}/api/v1/voice/realtime" \
  -t "$FRONTEND_ECR:local" \
  ../../mizan-frontend
docker push "$FRONTEND_ECR:local"

terraform apply \
  -var="backend_image_tag=local" \
  -var="frontend_image_tag=local"
aws cloudfront create-invalidation --distribution-id "$(terraform output -raw cloudfront_distribution_id)" --paths "/*"
```

## GitHub Actions State

The CI/CD workflow uses an S3 Terraform backend. Create one S3 bucket for Terraform state before enabling deployment:

```bash
aws s3 mb s3://<unique-tf-state-bucket> --region eu-west-3
aws s3api put-bucket-versioning \
  --bucket <unique-tf-state-bucket> \
  --versioning-configuration Status=Enabled
```

Set these GitHub secrets:

```text
AWS_DEPLOY_ENABLED=true
AWS_ACCESS_KEY_ID=<access-key>
AWS_SECRET_ACCESS_KEY=<secret-key>
AWS_REGION=eu-west-3
TF_STATE_BUCKET=<unique-tf-state-bucket>
TF_STATE_KEY=mizan/demo/terraform.tfstate
```

Optional application secrets:

```text
BACKEND_SECRET_KEY=<long-random-secret>
MISTRAL_API_KEY=<mistral-key>
CLOUDINARY_CLOUD_NAME=<cloudinary-name>
CLOUDINARY_API_KEY=<cloudinary-key>
CLOUDINARY_API_SECRET=<cloudinary-secret>
SMTP_USER=<smtp-user>
SMTP_PASSWORD=<smtp-password>
```

If `BACKEND_SECRET_KEY` is empty, Terraform generates a strong one.

## Deploy

Deployment happens on push to `main` when `AWS_DEPLOY_ENABLED=true`, or manually from GitHub Actions:

```text
Actions -> CI/CD -> Run workflow -> aws_action=deploy
```

The workflow:

1. Runs backend, frontend, and mobile checks.
2. Creates both ECR repositories if needed.
3. Builds and pushes the backend Docker image.
4. Builds and pushes a bootstrap frontend Docker image.
5. Applies Terraform for ECS, RDS, ALB, CloudFront, secrets, IAM, and logs.
6. Rebuilds the frontend image with the deployed CloudFront URL.
7. Applies Terraform again to switch ECS to the final frontend image.
8. Invalidates CloudFront.
9. Checks `/health`.

## Destroy

After the demo, shut everything down:

```text
Actions -> CI/CD -> Run workflow -> aws_action=destroy
```

Or locally:

```bash
cd infra/aws
terraform destroy
```

Destroying removes the ECS services, ALB, CloudFront distribution, RDS database, ECR repositories, Secrets Manager secret, IAM roles, security groups, and logs. CloudFront deletion can take several minutes.
