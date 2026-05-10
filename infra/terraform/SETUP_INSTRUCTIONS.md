# Step 9 — Infrastructure as Code Setup Guide

This guide walks you through setting up Terraform to manage your Digital Portfolio infrastructure across Vercel, Neon, and GitHub.

## Prerequisites

- **Terraform CLI** ≥ 1.5 ([install](https://www.terraform.io/downloads))
- **Terraform Cloud account** (free tier available: [app.terraform.io](https://app.terraform.io))
- **API tokens & keys** from:
  - Vercel: [vercel.com/account/tokens](https://vercel.com/account/tokens)
  - Neon: [console.neon.tech/app/settings/api-keys](https://console.neon.tech/app/settings/api-keys)
  - GitHub: [github.com/settings/tokens](https://github.com/settings/tokens)
  - OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
  - Anthropic: [console.anthropic.com](https://console.anthropic.com/account/keys)
  - Tavily: [tavily.com/dashboard](https://tavily.com/dashboard)
  - OpenWeather: [openweathermap.org/api](https://openweathermap.org/api)

## Step 1: Collect Required Tokens

Gather all the following values **before running Terraform**:

### Vercel Tokens
1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Name: `terraform-api` (or any descriptive name)
4. Scope: **Full Account Access**
5. Copy the token to a secure location

### Neon API Key
1. Go to [console.neon.tech/app/settings/api-keys](https://console.neon.tech/app/settings/api-keys)
2. Click "New API key"
3. Name: `terraform` (or any name)
4. Copy the key

### GitHub Personal Access Token
1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)" or "Generate new token"
3. Name: `terraform`
4. Scopes: Check `repo` (full control of repositories) + `admin:repo_hook`
5. Copy the token

### Neon Database Connection String
1. Go to [console.neon.tech](https://console.neon.tech) → Your Project
2. Click "Connection String"
3. Select "Pooled connection" (important for serverless!)
4. Copy the full string:
   ```
   postgresql://portfolio_app:PASSWORD@ep-xxxxx-pooler.neon.tech/portfolio?sslmode=require
   ```

### Vercel Blob Token
1. Go to Vercel Dashboard → Your Project → Storage tab
2. If Blob exists, click it → Copy the token
3. If Blob doesn't exist, click "Create" → Blob → Create bucket → Copy token

### Vercel Deployment Protection Bypass
1. Go to Vercel Dashboard → Project Settings → Deployment Protection
2. Scroll to "Protection Bypass for Automation"
3. Click "Generate Secret"
4. Copy the secret

### API Keys (OpenAI, Anthropic, Tavily, OpenWeather)
These are from existing .env or Vercel environment settings.

## Step 2: Create terraform.tfvars

```bash
cd infra/terraform

# Copy the example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values (use your preferred editor)
nano terraform.tfvars
```

Fill in all placeholder values with the tokens from Step 1. The file contains detailed comments explaining each value.

**Security reminder:** Never commit `terraform.tfvars`. It's in `.gitignore`.

## Step 3: Set Up Terraform Cloud

Terraform Cloud securely stores your state and sensitive variables.

### Create Organization

1. Sign up at [app.terraform.io](https://app.terraform.io)
2. Create an organization:
   - Click "Create organization"
   - Name: `thomas-abraham` (or your preferred org name)
   - Email: your email
   - Click "Create"

### Create Workspace

1. In your organization, click "New workspace"
2. Configuration:
   - Name: `digital-portfolio`
   - Terraform Working Directory: `infra/terraform` (optional but recommended)
   - VCS provider: Don't connect (we'll use local state migration)
3. Click "Create workspace"

### Generate API Token

1. Click your user icon (top-right) → Account Settings
2. Click "Tokens" → "Create an API token"
3. Copy the token — you'll use it in Step 4

## Step 4: Initialize Terraform

From the `infra/terraform` directory:

```bash
terraform init
```

When prompted:
```
Do you want to copy existing state to the new backend?
```

Say **yes** if you have a local `terraform.tfstate` file.

**Login to Terraform Cloud:**
```bash
terraform login
```

Paste the API token from Step 3. Terraform will save it to `~/.terraform/credentials.tfrc.json`.

## Step 4.5: Import the Existing Vercel Project (one-time)

Terraform manages the Vercel project as a `vercel_project` resource. Because
the project already exists in Vercel, you must **import** it before the first
`plan`. Without this step, Terraform would try to create a duplicate and the
Vercel API would reject the request (project name already taken).

```bash
# Find the project ID in Vercel Dashboard → Project → Settings → General
# Looks like: prj_xxxxxxxxxxxxxxxxxxxxxxxxxx
terraform import vercel_project.portfolio prj_xxxxxxxxxxxxxxxxxxxxxxxxxx
```

Replace the ID with your actual `prj_...` value. After import, run:

```bash
terraform plan
```

The first plan will likely show "in-place updates" for the project — Terraform
is reconciling the imported state with what's declared in `vercel.tf`. Review
each diff carefully:

- ✅ Expected: `auto_assign_custom_domains`, `git_fork_protection`, OIDC, and
  `vercel_authentication` becoming explicit (matches current Vercel state).
- ✅ Expected: `protection_bypass_for_automation = true` set.
- ❌ Unexpected: any field flipping a security-relevant setting (e.g. OIDC
  becoming `enabled = false`, or bypass becoming `null`). Stop and inspect.

## Step 5: Review the Plan

```bash
terraform plan -out=tfplan
```

This shows what Terraform will create/update/delete:
- Vercel environment variables
- GitHub Actions secrets
- References to existing Neon/Vercel resources

Review the output carefully. If something looks wrong, edit `terraform.tfvars` and run `terraform plan` again.

## Step 6: Apply the Configuration

```bash
terraform apply tfplan
```

Terraform will:
1. Create environment variables in Vercel
2. Create secrets in GitHub Actions
3. Set up references to your database and project

Watch the output for any errors. If successful, you'll see:
```
Apply complete! Resources added: X, changed: Y, destroyed: Z.
```

## Step 7: Verify

Check the outputs to confirm everything is set up:

```bash
terraform output infrastructure_summary
terraform output deployment_checklist
```

Then manually verify:

### Vercel
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Confirm all variables are present (DATABASE_URL, OPENAI_API_KEY, etc.)

### Neon
1. Go to Neon Console → Your Database
2. Verify connection pooling is enabled (endpoint should show "pooler")

### GitHub
1. Go to your repo → Settings → Secrets and Variables → Actions
2. Confirm secrets are present (OPENAI_API_KEY, VERCEL_TOKEN, VERCEL_AUTOMATION_BYPASS_SECRET)

## Step 8: Complete Manual Setup Tasks

Terraform can't automate everything yet. Complete these:

### Create pgvector Extension

```bash
# Connect to your database
psql $DATABASE_URL

# In the psql prompt:
CREATE EXTENSION IF NOT EXISTS vector;
```

### Create corpus_chunks Table

```sql
CREATE TABLE corpus_chunks (
  id text PRIMARY KEY,
  source text NOT NULL,
  topic text NOT NULL,
  text text NOT NULL,
  embedding vector(1536) NOT NULL
);

CREATE INDEX ON corpus_chunks USING hnsw (embedding vector_cosine_ops);
```

### Seed the Corpus

```bash
cd ../..  # Back to repo root
npx tsx scripts/seed-corpus.ts
```

## Step 9: Test the Deployment

Push to the `develop` branch and watch the CI pipeline:

```bash
git add .
git commit -m "Phase 3: Add Terraform IaC for Step 9"
git push origin develop
```

Then:
1. Watch GitHub Actions → CI workflow
2. Stage A should pass (lint, type-check, unit tests)
3. Vercel creates a Preview deployment
4. Stage B should pass (Ragas evaluation, Playwright E2E)
5. All 4 showcases should work with real data

## Step 10: Merge to Production

When everything is working:

```bash
git checkout master
git merge develop
git push origin master
```

Vercel will automatically deploy to production.

## Troubleshooting

### Terraform init fails with "Invalid token"

Check your Terraform Cloud token:
```bash
cat ~/.terraform.credentials.tfrc.json
```

If it looks wrong, regenerate the token at [app.terraform.io/app/settings/tokens](https://app.terraform.io/app/settings/tokens) and run `terraform login` again.

### "Project not found" (Vercel)

The Vercel project must exist first. If you created it manually:
1. Get the project ID from Vercel Dashboard (URL: `https://vercel.com/.../.../...`)
2. Import it:
   ```bash
   terraform import vercel_project.portfolio <project_id>
   ```
3. Run `terraform plan` again

### "Authentication failed" (Neon)

Double-check your `neon_api_key` in `terraform.tfvars`. Get a fresh one from [console.neon.tech/app/settings/api-keys](https://console.neon.tech/app/settings/api-keys).

### Plan shows "No changes"

This is normal! It means your infrastructure already matches the Terraform configuration. If you expected changes, check `terraform.tfvars` for any values that need updating.

## Security Best Practices

1. **Never commit `terraform.tfvars`** — it contains API keys
2. **Use Terraform Cloud** for encrypted state storage (not local `terraform.tfstate`)
3. **Rotate tokens periodically** — update `terraform.tfvars` and run `terraform apply`
4. **Review `terraform plan` before applying** — always read the diff
5. **Restrict GitHub Actions secrets** — mark as read-only where possible
6. **Use separate tokens for different services** — don't reuse the same key everywhere

## Next Steps

After successful deployment:
- Review the project URLs in the Terraform outputs
- Check [README.md](./README.md) for common tasks (rotating secrets, adding domains, etc.)
- Set up automatic `terraform plan` reviews on PRs (`.github/workflows/terraform-plan.yml` is already configured)

## Questions or Issues?

Refer to:
- [Terraform Docs](https://developer.hashicorp.com/terraform/docs)
- [Vercel Provider Docs](https://registry.terraform.io/providers/vercel/vercel/latest/docs)
- [kislerdm/neon Provider Docs](https://registry.terraform.io/providers/kislerdm/neon/latest/docs)
- [Terraform Cloud Docs](https://developer.hashicorp.com/terraform/cloud-docs)
