variable "aws_region" {
  description = "AWS region"
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  default     = "10.0.0.0/16"
}

variable "public_subnet_1_cidr" {
  description = "Public subnet 1 CIDR"
  default     = "10.0.1.0/24"
}

variable "public_subnet_2_cidr" {
  description = "Public subnet 2 CIDR"
  default     = "10.0.2.0/24"
}

variable "private_subnet_1_cidr" {
  description = "Private subnet 1 CIDR"
  default     = "10.0.10.0/24"
}

variable "private_subnet_2_cidr" {
  description = "Private subnet 2 CIDR"
  default     = "10.0.11.0/24"
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "ssh_cidr" {
  description = "CIDR block for SSH access"
  default     = "0.0.0.0/0"
}
