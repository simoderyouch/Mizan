variable "aws_region" {
  type        = string
  description = "AWS region for regional resources."
  default     = "eu-west-3"
}

variable "project_name" {
  type        = string
  description = "Name prefix for AWS resources."
  default     = "mizan"
}

variable "environment" {
  type        = string
  description = "Deployment environment name."
  default     = "demo"
}

variable "backend_image_tag" {
  type        = string
  description = "ECR image tag deployed to ECS."
  default     = "bootstrap"
}

variable "frontend_image_tag" {
  type        = string
  description = "ECR image tag deployed to the frontend ECS service."
  default     = "bootstrap"
}

variable "api_public_url" {
  type        = string
  description = "Optional public API URL override. Leave empty to use the API CloudFront URL."
  default     = ""
}

variable "app_domain" {
  type        = string
  description = "Optional custom app subdomain for CloudFront + ACM, e.g. mizan.example.com. Add DNS in Namecheap using terraform outputs."
  default     = ""
}

variable "backend_container_port" {
  type        = number
  description = "Backend container port."
  default     = 8000
}

variable "frontend_container_port" {
  type        = number
  description = "Frontend container port."
  default     = 3000
}

variable "backend_task_cpu" {
  type        = number
  description = "Fargate task CPU units. 512 is safer for the demo backend; 256 is cheaper."
  default     = 512
}

variable "backend_task_memory" {
  type        = number
  description = "Fargate task memory in MiB."
  default     = 1024
}

variable "backend_desired_count" {
  type        = number
  description = "Number of backend tasks to run."
  default     = 1
}

variable "frontend_task_cpu" {
  type        = number
  description = "Fargate task CPU units for the Next.js frontend."
  default     = 256
}

variable "frontend_task_memory" {
  type        = number
  description = "Fargate task memory in MiB for the Next.js frontend."
  default     = 512
}

variable "frontend_desired_count" {
  type        = number
  description = "Number of frontend tasks to run."
  default     = 1
}

variable "backend_secret_key" {
  type        = string
  description = "Optional JWT secret. Terraform generates one if empty."
  default     = ""
  sensitive   = true
}

variable "enable_scheduler" {
  type        = bool
  description = "Whether backend scheduled jobs run in ECS."
  default     = true
}

variable "db_name" {
  type        = string
  description = "PostgreSQL database name."
  default     = "mizan"
}

variable "db_username" {
  type        = string
  description = "PostgreSQL master username."
  default     = "mizan"
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class."
  default     = "db.t4g.micro"
}

variable "postgres_engine_version" {
  type        = string
  description = "RDS PostgreSQL major/minor engine version."
  default     = "16"
}

variable "db_allocated_storage_gb" {
  type        = number
  description = "Initial RDS storage size."
  default     = 20
}

variable "db_max_allocated_storage_gb" {
  type        = number
  description = "Maximum autoscaled RDS storage size."
  default     = 30
}

variable "db_backup_retention_days" {
  type        = number
  description = "RDS backup retention. Use 0 for the cheapest short demo."
  default     = 1
}

variable "db_deletion_protection" {
  type        = bool
  description = "Protect the database from accidental deletion. Keep false for one-day demo teardown."
  default     = false
}

variable "db_skip_final_snapshot" {
  type        = bool
  description = "Skip final RDS snapshot on destroy. Keep true for one-day demo teardown."
  default     = true
}

variable "db_pool_size" {
  type        = number
  description = "Backend DB pool size."
  default     = 5
}

variable "db_max_overflow" {
  type        = number
  description = "Backend DB max overflow connections."
  default     = 10
}

variable "db_pool_timeout" {
  type        = number
  description = "Backend DB pool timeout in seconds."
  default     = 30
}

variable "db_pool_recycle" {
  type        = number
  description = "Backend DB pool recycle in seconds."
  default     = 1800
}

variable "access_token_expire_minutes" {
  type        = number
  description = "Access token lifetime."
  default     = 30
}

variable "refresh_token_expire_days" {
  type        = number
  description = "Refresh token lifetime."
  default     = 7
}

variable "auth_rate_limit_max_requests" {
  type        = number
  description = "Auth rate-limit request count."
  default     = 10
}

variable "auth_rate_limit_window_seconds" {
  type        = number
  description = "Auth rate-limit window."
  default     = 60
}

variable "max_image_upload_bytes" {
  type        = number
  description = "Maximum image upload size."
  default     = 5242880
}

variable "max_audio_upload_bytes" {
  type        = number
  description = "Maximum audio upload size."
  default     = 26214400
}

variable "max_csv_upload_bytes" {
  type        = number
  description = "Maximum CSV upload size."
  default     = 5242880
}

variable "mistral_api_key" {
  type        = string
  description = "Mistral API key. Leave empty if AI features are not used during the demo."
  default     = ""
  sensitive   = true
}

variable "mistral_model" {
  type        = string
  description = "Mistral chat model."
  default     = "mistral-large-latest"
}

variable "mistral_stt_model" {
  type        = string
  description = "Mistral speech-to-text model."
  default     = "voxtral-mini-latest"
}

variable "mistral_stt_language" {
  type        = string
  description = "Speech-to-text language."
  default     = "fr"
}

variable "mistral_realtime_model" {
  type        = string
  description = "Mistral realtime transcription model."
  default     = "voxtral-mini-transcribe-realtime-2602"
}

variable "mistral_realtime_sample_rate" {
  type        = number
  description = "Realtime audio sample rate."
  default     = 16000
}

variable "mistral_realtime_target_delay_ms" {
  type        = number
  description = "Realtime transcription target delay."
  default     = 700
}

variable "mistral_realtime_server_url" {
  type        = string
  description = "Mistral realtime WebSocket base URL."
  default     = "wss://api.mistral.ai"
}

variable "mistral_tts_model" {
  type        = string
  description = "Mistral TTS model."
  default     = "voxtral-mini-tts-latest"
}

variable "mistral_tts_voice_id" {
  type        = string
  description = "Mistral TTS voice ID."
  default     = ""
}

variable "mistral_tts_voice" {
  type        = string
  description = "Mistral TTS voice name."
  default     = ""
}

variable "mistral_tts_output_gain" {
  type        = number
  description = "Mistral TTS output gain."
  default     = 2.0
}

variable "cloudinary_cloud_name" {
  type        = string
  description = "Cloudinary cloud name."
  default     = ""
}

variable "cloudinary_api_key" {
  type        = string
  description = "Cloudinary API key."
  default     = ""
  sensitive   = true
}

variable "cloudinary_api_secret" {
  type        = string
  description = "Cloudinary API secret."
  default     = ""
  sensitive   = true
}

variable "smtp_server" {
  type        = string
  description = "SMTP server."
  default     = "smtp.gmail.com"
}

variable "smtp_port" {
  type        = number
  description = "SMTP port."
  default     = 587
}

variable "smtp_user" {
  type        = string
  description = "SMTP username."
  default     = ""
}

variable "smtp_password" {
  type        = string
  description = "SMTP password."
  default     = ""
  sensitive   = true
}

variable "seed_demo_data" {
  type        = bool
  description = "Seed demo school, students, and check-in data on first backend startup when the database is empty."
  default     = true
}

variable "cloudfront_price_class" {
  type        = string
  description = "CloudFront price class. PriceClass_100 is the cheapest global option."
  default     = "PriceClass_100"
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention."
  default     = 7
}

variable "secret_recovery_window_days" {
  type        = number
  description = "Secrets Manager recovery window. Use 0 for immediate demo teardown."
  default     = 0
}

variable "force_delete_ecr" {
  type        = bool
  description = "Allow Terraform destroy to delete non-empty ECR repository."
  default     = true
}
