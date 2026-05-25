variable "aws_region" {
  type        = string
  description = "AWS region for the EC2 instance."
  default     = "eu-west-3"
}

variable "project_name" {
  type        = string
  description = "Name prefix for AWS resources."
  default     = "mizan"
}

variable "instance_type" {
  type        = string
  description = "EC2 instance type. t2.micro/t3.micro may be free-tier eligible depending on account and region."
  default     = "t2.micro"
}

variable "root_volume_size_gb" {
  type        = number
  description = "Root EBS volume size."
  default     = 20
}

variable "ssh_public_key" {
  type        = string
  description = "Public SSH key allowed to access the instance."
}

variable "ssh_allowed_cidr" {
  type        = string
  description = "CIDR allowed to SSH into the instance, for example 203.0.113.10/32."
}
