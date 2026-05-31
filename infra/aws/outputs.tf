output "app_url" {
  value       = local.public_origin
  description = "Public URL for the frontend and API (custom domain when configured)."
}

output "frontend_url" {
  value       = local.public_origin
  description = "Public frontend URL."
}

output "api_url" {
  value       = local.effective_api_url
  description = "Public API base origin (CloudFront). API routes live under /api/v1."
}

output "api_health_url" {
  value       = "${local.effective_api_url}/health"
  description = "Public backend health URL (custom domain when configured)."
}

output "api_health_check_url" {
  value       = "${local.cloudfront_public_origin}/health"
  description = "Health URL via CloudFront hostname. Use in CI before Namecheap DNS propagates."
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.app.id
  description = "CloudFront distribution ID for invalidations."
}

output "cloudfront_distribution_domain_name" {
  value       = aws_cloudfront_distribution.app.domain_name
  description = "CloudFront domain for the app."
}

output "frontend_build_api_url" {
  value       = local.frontend_build_api_url
  description = "API origin baked into the frontend image (always CloudFront)."
}

output "custom_domain_ready" {
  value       = local.use_custom_cloudfront_domain
  description = "True when ACM is Issued and CloudFront serves the custom domain."
}

output "acm_certificate_status" {
  value       = var.app_domain != "" ? aws_acm_certificate.app[0].status : null
  description = "ACM certificate status. Must be ISSUED before custom HTTPS domain works."
}

output "app_domain" {
  value       = var.app_domain != "" ? var.app_domain : null
  description = "Configured custom domain, if any."
}

output "acm_validation_records" {
  value = var.app_domain != "" ? [
    for dvo in aws_acm_certificate.app[0].domain_validation_options : {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  ] : []
  description = "Add these CNAME records in Namecheap to validate the ACM certificate."
}

output "namecheap_app_cname" {
  value = var.app_domain != "" ? {
    type        = "CNAME"
    full_domain = var.app_domain
    value       = aws_cloudfront_distribution.app.domain_name
    note        = "In Namecheap Advanced DNS, Host is only the subdomain label (e.g. mizan for mizan.example.com)."
  } : null
  description = "CNAME record to point your subdomain at CloudFront."
}

output "dns_setup_instructions" {
  value = var.app_domain != "" ? join("\n", concat(
    [
      "Custom domain: ${var.app_domain}",
      "",
      "Step 1 — ACM certificate validation (Namecheap Advanced DNS → CNAME):",
    ],
    [for dvo in aws_acm_certificate.app[0].domain_validation_options :
      "  Name: ${dvo.resource_record_name}\n  Value: ${dvo.resource_record_value}"
    ],
    [
      "",
      "Step 2 — Point subdomain to CloudFront (after ACM cert is Issued):",
      "  Type: CNAME",
      "  Host: subdomain label only (e.g. mizan for ${var.app_domain})",
      "  Value: ${aws_cloudfront_distribution.app.domain_name}",
      "",
      "Step 3 — Test: https://${var.app_domain}/health",
      "",
      "Step 4 — Re-run GitHub Actions deploy after ACM shows Issued (custom domain attaches automatically).",
    ]
  )) : "No custom domain configured. Use app_url (CloudFront URL)."
  description = "Human-readable DNS steps for Namecheap."
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
