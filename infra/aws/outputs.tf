output "public_ip" {
  value       = aws_instance.app.public_ip
  description = "Public IP address for DNS records and SSH."
}

output "ssh_user" {
  value       = "ubuntu"
  description = "Default SSH user for the Ubuntu AMI."
}

output "web_url" {
  value       = "http://${aws_instance.app.public_ip}"
  description = "Temporary HTTP URL before DNS and HTTPS are configured."
}
