# GitHub Configuration - Actions Secrets and Workflow Integration

# GitHub Actions Secrets for CI/CD
# These are used by .github/workflows/ci.yml and preview-eval.yml
resource "github_actions_secret" "openai_key" {
  repository  = var.github_repo
  secret_name = "OPENAI_API_KEY"
  value       = var.github_actions_openai_key
}

resource "github_actions_secret" "vercel_token" {
  repository  = var.github_repo
  secret_name = "VERCEL_TOKEN"
  value       = var.github_actions_vercel_token
}

resource "github_actions_secret" "vercel_bypass_secret" {
  repository  = var.github_repo
  secret_name = "VERCEL_AUTOMATION_BYPASS_SECRET"
  value       = var.github_actions_bypass_secret
}

# Optional: GitHub Actions variable for non-sensitive values
# These are viewable in GitHub UI, so no sensitive data
resource "github_actions_variable" "ragas_threshold" {
  repository    = var.github_repo
  variable_name = "RAGAS_FAITHFULNESS_THRESHOLD"
  value         = tostring(var.ragas_faithfulness_threshold)
}

resource "github_actions_variable" "site_url" {
  repository    = var.github_repo
  variable_name = "SITE_URL"
  value         = var.site_url
}

# Output for verification
output "github_secrets_created" {
  description = "GitHub Actions secrets successfully created"
  value = {
    openai_key          = "OPENAI_API_KEY"
    vercel_token        = "VERCEL_TOKEN"
    bypass_secret       = "VERCEL_AUTOMATION_BYPASS_SECRET"
  }
}

output "github_variables_created" {
  description = "GitHub Actions variables successfully created"
  value = {
    ragas_threshold = "RAGAS_FAITHFULNESS_THRESHOLD"
    site_url        = "SITE_URL"
  }
}
