# Terraform Variables for Digital Portfolio Infrastructure

variable "vercel_api_token" {
  description = "Vercel API token for authentication"
  type        = string
  sensitive   = true
}

variable "neon_api_key" {
  description = "Neon API key for authentication"
  type        = string
  sensitive   = true
}

variable "github_token" {
  description = "GitHub Personal Access Token for managing secrets and resources"
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic API key for Claude models"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key for embeddings (text-embedding-3-small) and Ragas judge"
  type        = string
  sensitive   = true
}

variable "tavily_api_key" {
  description = "Tavily API key for web search"
  type        = string
  sensitive   = true
}

variable "openweathermap_api_key" {
  description = "OpenWeather API key for weather data"
  type        = string
  sensitive   = true
}

variable "database_url" {
  description = "Neon Postgres connection string (pooled)"
  type        = string
  sensitive   = true
}

variable "blob_read_write_token" {
  description = "Vercel Blob storage read/write token"
  type        = string
  sensitive   = true
}

variable "vercel_automation_bypass_secret" {
  description = "Vercel Deployment Protection bypass secret (exactly 32 chars; Project → Deployment Protection)"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.vercel_automation_bypass_secret) == 32
    error_message = "vercel_automation_bypass_secret must be exactly 32 characters (Vercel API requirement)."
  }
}

variable "upstash_redis_rest_url" {
  description = "Upstash Redis REST URL for rate-limit middleware"
  type        = string
  sensitive   = true
}

variable "upstash_redis_rest_token" {
  description = "Upstash Redis REST token for rate-limit middleware"
  type        = string
  sensitive   = true
}

variable "github_actions_openai_key" {
  description = "OpenAI key for GitHub Actions (Ragas judge LLM)"
  type        = string
  sensitive   = true
}

variable "github_actions_vercel_token" {
  description = "Vercel token for GitHub Actions deployments"
  type        = string
  sensitive   = true
}

variable "github_actions_bypass_secret" {
  description = "Vercel bypass secret for GitHub Actions CI (32 chars; usually same as vercel_automation_bypass_secret)"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.github_actions_bypass_secret) == 32
    error_message = "github_actions_bypass_secret must be exactly 32 characters to match Vercel Protection Bypass."
  }
}

# Non-sensitive variables

variable "vercel_project_name" {
  description = "Vercel project name"
  type        = string
  default     = "digital-portfolio"
}

variable "vercel_team_id" {
  description = "Vercel team slug or team ID for provider default scope (optional; leave empty for Hobby)"
  type        = string
  default     = ""
}

variable "neon_project_id" {
  description = "Neon project ID (Console → project → Settings → General)"
  type        = string

  validation {
    condition     = length(trimspace(var.neon_project_id)) > 0
    error_message = "Set neon_project_id in terraform.tfvars (Neon Console → project settings)."
  }
}

variable "neon_region" {
  description = "Neon region for database"
  type        = string
  default     = "eu-west-1"
}

variable "github_owner" {
  description = "GitHub repository owner"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "Digital-Portfolio"
}

variable "primary_domain" {
  description = "Primary custom domain — hostname only, e.g. 'tvabraham.dev' (no scheme, no trailing slash). Leave empty to skip."
  type        = string
  default     = ""

  validation {
    condition     = var.primary_domain == "" || (!can(regex("://", var.primary_domain)) && !can(regex("/", var.primary_domain)))
    error_message = "primary_domain must be a hostname (e.g. 'tvabraham.dev'), not a URL. Remove 'https://' and any trailing '/'."
  }
}

variable "site_url" {
  description = "Production site URL — full https:// URL of the production site (custom domain or stable *.vercel.app alias). Avoid Preview slugs like 'eight-kappa' which change on each deploy."
  type        = string
  default     = "https://thomas-abraham.vercel.app"

  validation {
    condition     = can(regex("^https://", var.site_url))
    error_message = "site_url must start with 'https://'."
  }
}

variable "serverless_function_region" {
  description = "Vercel serverless function region"
  type        = string
  default     = "lhr1"
}

variable "ragas_faithfulness_threshold" {
  description = "Ragas evaluation faithfulness gate threshold"
  type        = number
  default     = 0.80
}

variable "blob_read_write_token_bucket" {
  description = "Vercel Blob bucket name"
  type        = string
  default     = "digital-portfolio-reports"
}
