terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

locals {
  name_prefix       = lower(replace("${var.project_name}-${var.environment}", "/[^a-z0-9-]/", "-"))
  subnet_count      = min(length(data.aws_subnets.default.ids), 2)
  subnet_ids        = slice(data.aws_subnets.default.ids, 0, local.subnet_count)
  backend_image     = "${aws_ecr_repository.backend.repository_url}:${var.backend_image_tag}"
  frontend_image    = "${aws_ecr_repository.frontend.repository_url}:${var.frontend_image_tag}"
  custom_public_origin       = var.app_domain != "" ? "https://${var.app_domain}" : ""
  cloudfront_public_origin   = "https://${aws_cloudfront_distribution.app.domain_name}"
  # API always uses CloudFront; custom domain is frontend-only (browser URL + CORS).
  effective_api_url          = var.api_public_url != "" ? trim(var.api_public_url, "/") : local.cloudfront_public_origin
  public_origin              = local.custom_public_origin != "" ? local.custom_public_origin : local.cloudfront_public_origin
  app_domain_cert_issued     = var.app_domain != "" && length(aws_acm_certificate.app) > 0 && aws_acm_certificate.app[0].status == "ISSUED"
  use_custom_cloudfront_domain = local.app_domain_cert_issued
  frontend_build_api_url       = local.cloudfront_public_origin
  backend_cors_origins     = join(",", compact([
    local.cloudfront_public_origin,
    local.custom_public_origin != "" ? local.custom_public_origin : "",
  ]))
  database_url      = "postgresql+asyncpg://${var.db_username}:${random_password.db_password.result}@${aws_db_instance.postgres.address}:5432/${var.db_name}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  backend_secret_values = {
    APP_ENV                          = "production"
    DATABASE_URL                     = local.database_url
    USE_LOCAL_DATABASE               = "false"
    DB_POOL_SIZE                     = tostring(var.db_pool_size)
    DB_MAX_OVERFLOW                  = tostring(var.db_max_overflow)
    DB_POOL_TIMEOUT                  = tostring(var.db_pool_timeout)
    DB_POOL_RECYCLE                  = tostring(var.db_pool_recycle)
    DB_POOL_PRE_PING                 = "true"
    SECRET_KEY                       = var.backend_secret_key != "" ? var.backend_secret_key : random_password.backend_secret_key.result
    ALGORITHM                        = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES      = tostring(var.access_token_expire_minutes)
    REFRESH_TOKEN_EXPIRE_DAYS        = tostring(var.refresh_token_expire_days)
    BACKEND_CORS_ORIGINS             = local.backend_cors_origins
    ENABLE_SCHEDULER                 = tostring(var.enable_scheduler)
    SEED_DEMO_DATA                   = tostring(var.seed_demo_data)
    AUTH_RATE_LIMIT_MAX_REQUESTS     = tostring(var.auth_rate_limit_max_requests)
    AUTH_RATE_LIMIT_WINDOW_SECONDS   = tostring(var.auth_rate_limit_window_seconds)
    MAX_IMAGE_UPLOAD_BYTES           = tostring(var.max_image_upload_bytes)
    MAX_AUDIO_UPLOAD_BYTES           = tostring(var.max_audio_upload_bytes)
    MAX_CSV_UPLOAD_BYTES             = tostring(var.max_csv_upload_bytes)
    MISTRAL_API_KEY                  = var.mistral_api_key
    MISTRAL_MODEL                    = var.mistral_model
    MISTRAL_STT_MODEL                = var.mistral_stt_model
    MISTRAL_STT_LANGUAGE             = var.mistral_stt_language
    MISTRAL_REALTIME_MODEL           = var.mistral_realtime_model
    MISTRAL_REALTIME_SAMPLE_RATE     = tostring(var.mistral_realtime_sample_rate)
    MISTRAL_REALTIME_TARGET_DELAY_MS = tostring(var.mistral_realtime_target_delay_ms)
    MISTRAL_REALTIME_SERVER_URL      = var.mistral_realtime_server_url
    MISTRAL_TTS_MODEL                = var.mistral_tts_model
    MISTRAL_TTS_VOICE_ID             = var.mistral_tts_voice_id
    MISTRAL_TTS_VOICE                = var.mistral_tts_voice
    MISTRAL_TTS_OUTPUT_GAIN          = tostring(var.mistral_tts_output_gain)
    CLOUDINARY_CLOUD_NAME            = var.cloudinary_cloud_name
    CLOUDINARY_API_KEY               = var.cloudinary_api_key
    CLOUDINARY_API_SECRET            = var.cloudinary_api_secret
    SMTP_SERVER                      = var.smtp_server
    SMTP_PORT                        = tostring(var.smtp_port)
    SMTP_USER                        = var.smtp_user
    SMTP_PASSWORD                    = var.smtp_password
  }
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "random_password" "backend_secret_key" {
  length  = 64
  special = false
}

resource "aws_ecr_repository" "backend" {
  name                 = "${local.name_prefix}-backend"
  image_tag_mutability = "MUTABLE"
  force_delete         = var.force_delete_ecr

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

resource "aws_ecr_repository" "frontend" {
  name                 = "${local.name_prefix}-frontend"
  image_tag_mutability = "MUTABLE"
  force_delete         = var.force_delete_ecr

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 10 backend images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_ecr_lifecycle_policy" "frontend" {
  repository = aws_ecr_repository.frontend.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 10 frontend images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name_prefix}/backend"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/${local.name_prefix}/frontend"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_secretsmanager_secret" "backend" {
  name                    = "${local.name_prefix}-backend-env"
  recovery_window_in_days = var.secret_recovery_window_days
  tags                    = local.common_tags
}

resource "aws_secretsmanager_secret_version" "backend" {
  secret_id     = aws_secretsmanager_secret.backend.id
  secret_string = jsonencode(local.backend_secret_values)
}

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb"
  description = "Public HTTP access to the app load balancer"
  vpc_id      = data.aws_vpc.default.id
  tags        = local.common_tags

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-ecs"
  description = "ECS frontend and backend tasks"
  vpc_id      = data.aws_vpc.default.id
  tags        = local.common_tags

  ingress {
    description     = "Backend traffic from ALB"
    from_port       = var.backend_container_port
    to_port         = var.backend_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Frontend traffic from ALB"
    from_port       = var.frontend_container_port
    to_port         = var.frontend_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "db" {
  name        = "${local.name_prefix}-db"
  description = "PostgreSQL access from backend tasks"
  vpc_id      = data.aws_vpc.default.id
  tags        = local.common_tags

  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${local.name_prefix}-postgres"
  subnet_ids = local.subnet_ids
  tags       = local.common_tags
}

resource "aws_db_instance" "postgres" {
  identifier                   = "${local.name_prefix}-postgres"
  engine                       = "postgres"
  engine_version               = var.postgres_engine_version
  instance_class               = var.db_instance_class
  allocated_storage            = var.db_allocated_storage_gb
  max_allocated_storage        = var.db_max_allocated_storage_gb
  storage_type                 = "gp3"
  db_name                      = var.db_name
  username                     = var.db_username
  password                     = random_password.db_password.result
  db_subnet_group_name         = aws_db_subnet_group.postgres.name
  vpc_security_group_ids       = [aws_security_group.db.id]
  publicly_accessible          = false
  multi_az                     = false
  backup_retention_period      = var.db_backup_retention_days
  deletion_protection          = var.db_deletion_protection
  skip_final_snapshot          = var.db_skip_final_snapshot
  final_snapshot_identifier    = var.db_skip_final_snapshot ? null : "${local.name_prefix}-final"
  auto_minor_version_upgrade   = true
  apply_immediately            = true
  performance_insights_enabled = false
  tags                         = local.common_tags
}

resource "aws_lb" "app" {
  name               = "${local.name_prefix}-alb"
  load_balancer_type = "application"
  subnets            = local.subnet_ids
  security_groups    = [aws_security_group.alb.id]
  idle_timeout        = 120
  tags               = local.common_tags
}

resource "aws_lb_target_group" "frontend" {
  name        = "${local.name_prefix}-frontend"
  port        = var.frontend_container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = data.aws_vpc.default.id
  tags        = local.common_tags

  health_check {
    enabled             = true
    path                = "/"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "${local.name_prefix}-backend"
  port        = var.backend_container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = data.aws_vpc.default.id
  tags        = local.common_tags

  health_check {
    enabled             = true
    path                = "/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

resource "aws_lb_listener_rule" "backend_api" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/v1", "/api/v1/*", "/health", "/docs", "/openapi.json"]
    }
  }
}

resource "aws_cloudfront_distribution" "app" {
  enabled             = true
  comment             = "${local.name_prefix} app"
  price_class         = var.cloudfront_price_class
  wait_for_deployment = false
  aliases             = local.use_custom_cloudfront_domain ? [var.app_domain] : []

  origin {
    domain_name = aws_lb.app.dns_name
    origin_id   = "app-alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id         = "app-alb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  dynamic "viewer_certificate" {
    for_each = local.use_custom_cloudfront_domain ? [1] : []
    content {
      acm_certificate_arn      = aws_acm_certificate.app[0].arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  dynamic "viewer_certificate" {
    for_each = local.use_custom_cloudfront_domain ? [] : [1]
    content {
      cloudfront_default_certificate = true
    }
  }

  tags = local.common_tags
}

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"
  tags = local.common_tags
}

data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "${local.name_prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "task_execution_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.backend.arn]
  }
}

resource "aws_iam_role_policy" "task_execution_secrets" {
  name   = "${local.name_prefix}-secrets"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution_secrets.json
}

resource "aws_iam_role" "task" {
  name               = "${local.name_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
  tags               = local.common_tags
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name_prefix}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.backend_task_cpu
  memory                   = var.backend_task_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "backend"
    image     = local.backend_image
    essential = true
    portMappings = [{
      containerPort = var.backend_container_port
      hostPort      = var.backend_container_port
      protocol      = "tcp"
    }]
    secrets = [
      for key in keys(local.backend_secret_values) : {
        name      = key
        valueFrom = "${aws_secretsmanager_secret.backend.arn}:${key}::"
      }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.backend.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "backend"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:${var.backend_container_port}/health', timeout=5)\""]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${local.name_prefix}-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.frontend_task_cpu
  memory                   = var.frontend_task_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "frontend"
    image     = local.frontend_image
    essential = true
    portMappings = [{
      containerPort = var.frontend_container_port
      hostPort      = var.frontend_container_port
      protocol      = "tcp"
    }]
    environment = [
      { name = "NEXT_PUBLIC_API_URL", value = local.frontend_build_api_url },
      { name = "NEXT_PUBLIC_WS_URL", value = "${replace(local.frontend_build_api_url, "https://", "wss://")}/api/v1/voice/realtime" },
      { name = "NEXT_PUBLIC_AI_VOICE_VOLUME", value = "1" },
      { name = "NEXT_PUBLIC_AI_VOICE_BOOST", value = "1.8" }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.frontend.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "frontend"
      }
    }
  }])

  tags = local.common_tags
}

resource "aws_ecs_service" "backend" {
  name            = "${local.name_prefix}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.backend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = var.backend_container_port
  }

  depends_on = [
    aws_lb_listener_rule.backend_api,
    aws_iam_role_policy_attachment.task_execution,
    aws_iam_role_policy.task_execution_secrets,
    aws_secretsmanager_secret_version.backend
  ]

  tags = local.common_tags
}

resource "aws_ecs_service" "frontend" {
  name            = "${local.name_prefix}-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.frontend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = var.frontend_container_port
  }

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy_attachment.task_execution
  ]

  tags = local.common_tags
}
