# Infrastructure as Code — Terraform

This directory contains the Terraform configuration for the Digital Portfolio infrastructure. It manages:

- **Vercel** — Project settings, environment variables, domains
- **Neon Postgres** — Database, branches, roles, connection pooling
- **GitHub Actions** — CI/CD secrets and variables

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Terraform Cloud (Remote State)                     │
│  - organization: thomas-abraham                     │
│  - workspace: digital-portfolio                     │
│  - stores encrypted state, plans, apply logs        │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
         ┌───────────────────────┐
         │  terraform apply      │
         │  (local CLI)          │
         └───────────────────────┘
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
    ┌─────────┐ ┌──────────┐ ┌──────────┐
    │ Vercel  │ │   Neon   │ │  GitHub  │
    │ Project │ │ Database │ │ Secrets  │
    └─────────┘ └──────────┘ └──────────┘
```

## Files

| File | Purpose |
|------|---------|
| `variables.tf` | Input variables (tokens, API keys, configuration) |
| `main.tf` | Provider configuration and local variables |
| `vercel.tf` | Vercel project, environment variables, domains |
| `neon.tf` | Neon database, branches, endpoints, roles |
| `github.tf` | GitHub Actions secrets and CI variables |
| `outputs.tf` | Output values and deployment checklist |
| `terraform.tfvars` | **GITIGNORED** — Local values (never commit) |
| `terraform.tfvars.example` | Example structure (committed to repo) |
| `.terraform/` | **GITIGNORED** — Terraform cache |
| `terraform.tfstate*` | **GITIGNORED** — State files (stored in Terraform Cloud) |

## Quick Start

### 1. Prerequisites

- **Terraform** ≥ 1.5 ([download](https://www.terraform.io/downloads))
- **Tokens and API keys** (see `terraform.tfvars.example`)
- **Terraform Cloud account** (free tier: [app.terraform.io](https://app.terraform.io))

### 2. Set Up terraform.tfvars

```bash
# Copy the example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your real values
nano terraform.tfvars  # or use your editor
```

### 3. Initialize Terraform

```bash
cd infra/terraform
terraform init
```

When prompted, log into Terraform Cloud (`terraform login`). Paste your API token from [app.terraform.io/app/settings/tokens](https://app.terraform.io/app/settings/tokens).

### 4. Plan the Infrastructure

```bash
terraform plan -out=tfplan
```

Review the plan to see what will be created/updated/destroyed.

### 5. Apply the Configuration

```bash
terraform apply tfplan
```

Terraform will create/import resources and save encrypted state to Terraform Cloud.

### 6. Verify

Check the outputs:

```bash
terraform output infrastructure_summary
terraform output deployment_checklist
```

## Security & State Management

### Local State

When you first run `terraform init`, Terraform creates `.terraform/` (cached provider plugins). The state file (`terraform.tfstate`) is created locally until you set up Terraform Cloud.

**✅ DO:**
- Set up Terraform Cloud immediately after first `terraform init`
- Push local state to Terraform Cloud workspace

**❌ DON'T:**
- Commit `terraform.tfstate` or `.terraform/` to git
- Share `terraform.tfvars` (contains API keys)
- Run `terraform apply` without reviewing `terraform plan` output

### Terraform Cloud State

After migrating to Terraform Cloud:
- State is encrypted at rest
- Sensitive variables are masked in plan output automatically
- Plan/apply actions are logged and auditable
- You can set team permissions on the workspace

### GitHub Actions CI

The workflow `.github/workflows/terraform-plan.yml` runs `terraform plan` on every PR touching `infra/`, but cannot execute `terraform apply` (read-only).

To apply changes:
```bash
terraform apply
```
from your local machine after merging to `main`.

## Common Tasks

### Import Existing Resources

If you created Vercel/Neon resources manually and want Terraform to manage them:

```bash
# Import existing Vercel project
terraform import vercel_project.portfolio <project_id>

# Neon is referenced via data.neon_project — set neon_project_id in terraform.tfvars (Console → Settings → General).
# To manage Neon with Terraform resources instead, see kislerdm/neon docs for neon_project and import syntax.
```

Get resource IDs from the Vercel dashboard where applicable.

### Rotate Secrets

Update `terraform.tfvars` with new token values:

```bash
# Edit the file
nano terraform.tfvars

# Apply the changes
terraform plan
terraform apply
```

Terraform automatically updates Vercel environment variables and GitHub Actions secrets.

### Add a Custom Domain

Update `terraform.tfvars`:

```hcl
primary_domain = "thomas-abraham.dev"
```

Then:

```bash
terraform plan
terraform apply
```

### Create a Development Database Branch

Uncomment the `neon_branch.dev` and `neon_endpoint.dev` resources in `neon.tf`, then:

```bash
terraform plan
terraform apply
```

## Troubleshooting

### Error: "Project not found" (Vercel)

The project must exist in Vercel first. Create it manually:
1. Go to [vercel.com/new](https://vercel.com/new)
2. Connect your GitHub repo
3. Deploy once
4. Get the project ID from Vercel dashboard
5. Import it: `terraform import vercel_project.portfolio <project_id>`

### Error: "Authentication failed" (Neon)

Verify your `neon_api_key` in `terraform.tfvars` is correct. Get a new one from [console.neon.tech/app/settings/api-keys](https://console.neon.tech/app/settings/api-keys).

### Error: "State lock timeout"

Another CI job or developer is running `terraform apply`. Wait for it to finish, or unlock manually:

```bash
terraform force-unlock <lock_id>
```

### Error: "GitHub token insufficient scopes"

Regenerate the GitHub PAT with scopes:
- `repo` (full control of repositories)
- `admin:repo_hook` (for managing secrets)

Get a new one from [github.com/settings/tokens](https://github.com/settings/tokens).

## Manual Steps Not Yet Automated

These require Vercel/Neon dashboard clicks:

- **Vercel Blob storage** — Create bucket via `Storage` tab. Terraform provider doesn't support this yet.
  - Set `blob_read_write_token` and `blob_hostname` in `terraform.tfvars` after creation.
- **Deployment Protection bypass secret** — Generate in Vercel Project Settings → Deployment Protection → Protection Bypass for Automation.
- **Neon pgvector extension** — Install after Terraform creates the database:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- **PostgreSQL schema** — Create `corpus_chunks` table; run `scripts/seed-corpus.ts` after.

## References

- [Vercel Terraform Provider Docs](https://registry.terraform.io/providers/vercel/vercel/latest/docs)
- [Neon Terraform Provider Docs](https://registry.terraform.io/providers/kislerdm/neon/latest/docs) (community provider; [Neon reference](https://neon.tech/docs/reference/terraform))
- [GitHub Terraform Provider Docs](https://registry.terraform.io/providers/integrations/github/latest/docs)
- [Terraform Cloud Documentation](https://developer.hashicorp.com/terraform/cloud-docs)
- [Terraform Best Practices](https://developer.hashicorp.com/terraform/cloud-docs/best-practices)
