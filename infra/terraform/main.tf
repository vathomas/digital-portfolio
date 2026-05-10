terraform {
  required_version = ">= 1.5"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 2.0"
    }
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.13"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  cloud {
    organization = "thomas-abraham"  # Change to your Terraform Cloud organization

    workspaces {
      name = "digital-portfolio"
    }
  }
}

# Vercel Provider Configuration
provider "vercel" {
  api_token = var.vercel_api_token
  # Default scope for resources/data sources — slug or team ID (omit for personal Hobby account).
  team = trimspace(var.vercel_team_id) != "" ? var.vercel_team_id : null
}

# Neon Provider Configuration
provider "neon" {
  api_key = var.neon_api_key
}

# GitHub Provider Configuration
provider "github" {
  token = var.github_token
  owner = var.github_owner
}

# Local variables for reuse
locals {
  common_tags = {
    Project     = "digital-portfolio"
    Environment = "production"
    ManagedBy   = "Terraform"
    CreatedAt   = timestamp()
  }

  # Environment variables that go into Vercel (non-sensitive in manifest)
  vercel_env_vars = {
    "DATABASE_URL"                    = var.database_url
    "ANTHROPIC_API_KEY"               = var.anthropic_api_key
    "OPENAI_API_KEY"                  = var.openai_api_key
    "TAVILY_API_KEY"                  = var.tavily_api_key
    "OPENWEATHERMAP_API_KEY"          = var.openweathermap_api_key
    "BLOB_READ_WRITE_TOKEN"           = var.blob_read_write_token
    "VERCEL_AUTOMATION_BYPASS_SECRET" = var.vercel_automation_bypass_secret
  }

  # GitHub Actions secrets
  github_actions_secrets = {
    "OPENAI_API_KEY"                  = var.github_actions_openai_key
    "VERCEL_TOKEN"                    = var.github_actions_vercel_token
    "VERCEL_AUTOMATION_BYPASS_SECRET" = var.github_actions_bypass_secret
  }
}
