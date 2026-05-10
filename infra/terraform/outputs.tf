# Terraform Outputs - Summary of created/managed resources

output "infrastructure_summary" {
  description = "Summary of managed infrastructure"
  value = {
    vercel_project = {
      name = vercel_project.portfolio.name
      id   = vercel_project.portfolio.id
      url  = "https://${vercel_project.portfolio.name}.vercel.app"
    }
    neon_database = {
      project_name = data.neon_project.portfolio.name
      project_id   = data.neon_project.portfolio.id
      database     = data.neon_project.portfolio.database_name
      region       = var.neon_region
    }
    github = {
      owner      = var.github_owner
      repository = var.github_repo
    }
  }
}

output "deployment_checklist" {
  description = "Items to verify after terraform apply"
  value = {
    vercel = [
      "Check Vercel dashboard: https://vercel.com/dashboard/${vercel_project.portfolio.name}",
      "Verify all environment variables are set under Project Settings → Environment Variables",
      "Check Deployment Protection is configured in Project Settings",
      "Confirm Blob storage is linked (if not, add manually from Storage tab)",
    ]
    neon = [
      "Verify Postgres database is accessible from Vercel functions",
      "Check connection pooling is enabled (should show 'pooler' in endpoint name)",
      "Confirm pgvector extension is installed: CREATE EXTENSION vector;",
      "Seed corpus_chunks table with eval/seed-corpus.ts",
    ]
    github = [
      "Verify secrets appear in repo Settings → Secrets and Variables → Actions",
      "Run Stage B workflow manually to test: GitHub → Actions → CI — Stage B → Run workflow",
      "Check Ragas evaluation results in artifact: ragas-results",
    ]
    general = [
      "Keep terraform.tfstate (if local) or Terraform Cloud workspace backed up",
      "Review .github/workflows/terraform-plan.yml for automatic drift detection",
      "Set up Terraform Cloud to store state securely",
    ]
  }
}

output "next_steps" {
  description = "Recommended next actions"
  value = <<-EOT
    After terraform apply completes:

    1. VERCEL SETUP:
       - Go to https://vercel.com/dashboard/${vercel_project.portfolio.name}
       - Project Settings → Deployment Protection:
         Enable "Vercel Authentication" for Preview URLs
         OR enable "Protection Bypass for Automation" and confirm VERCEL_AUTOMATION_BYPASS_SECRET is set
       - Storage → Blob: If not present, create bucket "digital-portfolio-reports"

    2. NEON DATABASE SETUP:
       - Connect to the database:
         psql $DATABASE_URL
       - Create pgvector extension:
         CREATE EXTENSION IF NOT EXISTS vector;
       - Create corpus_chunks table:
         CREATE TABLE corpus_chunks (
           id text PRIMARY KEY,
           source text NOT NULL,
           topic text NOT NULL,
           text text NOT NULL,
           embedding vector(1536) NOT NULL
         );
         CREATE INDEX ON corpus_chunks USING hnsw (embedding vector_cosine_ops);
       - Run seed script:
         npx tsx scripts/seed-corpus.ts

    3. VERIFY DEPLOYMENT:
       - Push to develop branch
       - Watch GitHub Actions → CI workflow
       - Check Stage A passes (lint, typecheck, tests)
       - Wait for Vercel Preview deployment
       - Check Stage B passes (Ragas + Playwright)
       - Merge to master → Production deploy

    4. TERRAFORM CLOUD:
       - Log in to https://app.terraform.io
       - Create workspace "digital-portfolio" in organization "thomas-abraham"
       - Upload terraform.tfstate to workspace (via web UI or CLI)
       - Future terraform commands will use Terraform Cloud state automatically

    5. CI/CD SETUP:
       - Merge .github/workflows/terraform-plan.yml to develop
       - Any PRs touching infra/ will trigger terraform plan (read-only)
       - Only terraform apply via CLI when ready to change infrastructure
  EOT
}

output "terraform_cloud_instructions" {
  description = "How to set up Terraform Cloud"
  value = <<-EOT
    1. Sign up at https://app.terraform.io (free tier available)
    2. Create organization: terraform.io/app/admin/organizations/new
    3. Create workspace: terraform.io/app/[org]/workspaces/new
       - Workspace name: digital-portfolio
       - Terraform Working Directory: infra/terraform
    4. Set workspace variables:
       - Name: VERCEL_API_TOKEN, Category: Variable, Value: [copy from terraform.tfvars]
       - Name: NEON_API_KEY, Category: Variable, Value: [copy from terraform.tfvars]
       - Name: GITHUB_TOKEN, Category: Variable, Value: [copy from terraform.tfvars]
       - (Repeat for all sensitive variables)
    5. From local machine:
       terraform login
       terraform init    # It will prompt to link to the workspace
       terraform plan    # Verify everything looks right
       terraform apply   # Creates/updates resources
    6. Delete local terraform.tfstate* files after apply succeeds
  EOT
}
