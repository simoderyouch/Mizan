output "app_url" {
  value       = local.public_origin
  description = "Public CloudFront URL for the frontend and API."
}

output "frontend_url" {
  value       = local.public_origin
  description = "Public frontend URL."
}

output "api_url" {
  value       = local.effective_api_url
  description = "Public API base origin. API routes live under /api/v1."
}

output "api_health_url" {
  value       = "${local.effective_api_url}/health"
  description = "Public backend health URL."
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.app.id
  description = "CloudFront distribution ID for invalidations."
}

output "cloudfront_distribution_domain_name" {
  value       = aws_cloudfront_distribution.app.domain_name
  description = "CloudFront domain for the app."
}

output "alb_dns_name" {
  value       = aws_lb.app.dns_name
  description = "Application Load Balancer DNS name. Use the CloudFront URL publicly."
}

output "backend_ecr_repository_url" {
  value       = aws_ecr_repository.backend.repository_url
  description = "ECR repository URL for backend images."
}

output "frontend_ecr_repository_url" {
  value       = aws_ecr_repository.frontend.repository_url
  description = "ECR repository URL for frontend images."
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.main.name
  description = "ECS cluster name."
}

output "backend_ecs_service_name" {
  value       = aws_ecs_service.backend.name
  description = "ECS backend service name."
}

output "frontend_ecs_service_name" {
  value       = aws_ecs_service.frontend.name
  description = "ECS frontend service name."
}

output "rds_endpoint" {
  value       = aws_db_instance.postgres.address
  description = "Private RDS endpoint."
}
