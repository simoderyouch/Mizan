# AWS Infrastructure

This Terraform module creates a small EC2 instance for Mizan using the default VPC.

It creates:

- one Ubuntu EC2 instance
- one security group
- one EC2 SSH key pair

It opens:

- SSH `22` only from `ssh_allowed_cidr`
- HTTP `80`
- HTTPS `443`

The default instance type is `t2.micro`, which may be AWS free-tier eligible depending on your account, region, and usage. You are responsible for checking AWS billing/free-tier eligibility before applying.

## Required Values

```bash
export TF_VAR_ssh_public_key="$(cat ~/.ssh/id_ed25519.pub)"
export TF_VAR_ssh_allowed_cidr="<your-public-ip>/32"
```

## Local Usage

```bash
cd infra/aws
terraform init
terraform plan
terraform apply
terraform output public_ip
```

After creation, point DNS records to the output public IP:

```text
A  mizan  <public_ip>
A  api    <public_ip>
```
