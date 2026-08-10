variable "aws_region" {
  description = "AWS region used for bootstrap resources"
  type        = string
  default     = "ap-southeast-1"
}

variable "github_owner" {
  description = "GitHub repository owner"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
}