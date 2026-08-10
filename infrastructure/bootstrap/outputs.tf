output "github_actions_role_arn" {
  description = "IAM Role ARN used by GitHub Actions via OIDC"
  value       = aws_iam_role.github_actions.arn
}

output "github_oidc_provider_arn" {
  description = "GitHub Actions OIDC Provider ARN"
  value       = aws_iam_openid_connect_provider.github.arn
}