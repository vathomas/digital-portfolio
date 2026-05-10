# Neon Postgres — uses community provider kislerdm/neon (see Neon Terraform docs).

data "neon_project" "portfolio" {
  id = var.neon_project_id
}

output "neon_project_id" {
  description = "Neon project ID"
  value       = data.neon_project.portfolio.id
}

output "neon_host" {
  description = "Neon database host (connection pooler)"
  value       = data.neon_project.portfolio.database_host_pooler
  sensitive   = true
}

output "neon_pooled_connection_string" {
  description = "Neon pooled connection string template (default branch role / DB from project)"
  value       = "postgresql://${data.neon_project.portfolio.database_user}:<password>@${data.neon_project.portfolio.database_host_pooler}/${data.neon_project.portfolio.database_name}?sslmode=require"
  sensitive   = true
}

# Optional: Create a development branch (commented by default)
/*
resource "neon_branch" "dev" {
  project_id = data.neon_project.portfolio.id
  name       = "develop"
  parent_id  = data.neon_project.portfolio.default_branch_id
}

resource "neon_endpoint" "dev" {
  project_id     = data.neon_project.portfolio.id
  branch_id      = neon_branch.dev.id
  type           = "read_write"
  pooler_enabled = true
}
*/
