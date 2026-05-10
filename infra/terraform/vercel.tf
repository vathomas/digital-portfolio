# Vercel Project and Environment Configuration
#
# • Project missing (e.g. after `terraform destroy`): run `terraform apply` —
#   Terraform creates `vercel_project.portfolio` and env vars from scratch.
# • Project already exists in Vercel but not in state: import first:
#     terraform import vercel_project.portfolio <project_id>
#   (<project_id> = Settings → General, shape `prj_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`.)
#
# ~> Do not add inline `environment = [...]` on `vercel_project` while using
#    `vercel_project_environment_variable` below (Vercel API conflict).

# ─────────────────────────────────────────────────────────────────────────────
# Vercel project
# ─────────────────────────────────────────────────────────────────────────────
resource "vercel_project" "portfolio" {
  name                       = var.vercel_project_name
  framework                  = "astro"
  build_command              = "npm run build"
  dev_command                = "npm run dev"
  # Repo root: leave root_directory unset — Vercel API rejects "." (invalid_root_directory).
  serverless_function_region = var.serverless_function_region

  # Pin behaviour explicitly so plans don't silently flip these on drift.
  auto_assign_custom_domains = true
  git_fork_protection        = true

  git_repository = {
    type = "github"
    repo = "${var.github_owner}/${var.github_repo}"
  }

  # Keep OIDC enabled (matches existing project state — disabling it would
  # break any keyless/federated auth flows that depend on the issuer).
  oidc_token_config = {
    enabled     = true
    issuer_mode = "global"
  }

  # Vercel Authentication for Preview deployments. Stage B CI relies on the
  # bypass secret below to reach auth-walled previews.
  # `standard_protection` = auth required for all Preview URLs.
  # `all_except_custom_domains` = auth on *.vercel.app, custom domains public.
  vercel_authentication = {
    deployment_type = "standard_protection"
  }

  # CI sends `x-vercel-protection-bypass` with this value (must match
  # VERCEL_AUTOMATION_BYPASS_SECRET env vars below). Vercel expects a
  # 32-character secret; generate one if yours differs.
  protection_bypass_for_automation        = true
  protection_bypass_for_automation_secret = var.vercel_automation_bypass_secret
}

# ─────────────────────────────────────────────────────────────────────────────
# Environment variables (one resource per env target)
# References vercel_project.portfolio.id (the managed resource), not a data
# source — once imported, the resource is the source of truth.
# ─────────────────────────────────────────────────────────────────────────────
resource "vercel_project_environment_variable" "production" {
  for_each = local.vercel_env_vars

  project_id = vercel_project.portfolio.id
  key        = each.key
  value      = each.value
  target     = ["production"]
  sensitive  = true
}

resource "vercel_project_environment_variable" "preview" {
  for_each = local.vercel_env_vars

  project_id = vercel_project.portfolio.id
  key        = each.key
  value      = each.value
  target     = ["preview"]
  sensitive  = true
}

# ─────────────────────────────────────────────────────────────────────────────
# Custom domain (only created when primary_domain is non-empty)
# Vercel expects a hostname here — e.g. "tvabraham.dev" — NOT a URL.
# Validation in variables.tf rejects values containing "://" or "/".
# ─────────────────────────────────────────────────────────────────────────────
resource "vercel_project_domain" "primary" {
  count = var.primary_domain != "" ? 1 : 0

  project_id = vercel_project.portfolio.id
  domain     = var.primary_domain
}

# ─────────────────────────────────────────────────────────────────────────────
# Outputs
# ─────────────────────────────────────────────────────────────────────────────
output "vercel_project_id" {
  description = "Vercel project ID"
  value       = vercel_project.portfolio.id
}

output "vercel_project_name" {
  description = "Vercel project name"
  value       = vercel_project.portfolio.name
}

output "vercel_production_url" {
  description = "Vercel production URL (default *.vercel.app alias)"
  value       = "https://${vercel_project.portfolio.name}.vercel.app"
}
