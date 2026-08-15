# GitHub Actions Setup Guide for Transcend SSP

Complete step-by-step instructions for configuring GitHub Actions with secrets, deployment webhooks, and repository permissions for the Transcend Law Platform.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Creating GitHub Personal Access Token](#creating-github-personal-access-token)
3. [Adding GITHUB_TOKEN Secret](#adding-github_token-secret)
4. [Setting DEPLOYMENT_WEBHOOK_URL](#setting-deployment_webhook_url)
5. [Configuring GitHub Repository Permissions](#configuring-github-repository-permissions)
6. [Testing Workflow Trigger Manually](#testing-workflow-trigger-manually)
7. [Monitoring Workflow Runs](#monitoring-workflow-runs)
8. [Debugging Failed Deployments](#debugging-failed-deployments)
9. [Security Best Practices](#security-best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **GitHub account** with admin access to the repository
- **Repository URL**: `https://github.com/jbconsultingassociatesinc/transcend-ssp`
- **Deployment environment** (staging or production server)
- **Webhook endpoint** ready to receive deployment notifications
- **GitHub CLI** (optional, but recommended) installed locally

### Required Permissions

Your GitHub account must have:
- Repository admin access
- Organization owner or admin privileges (if applicable)
- Access to repository settings and secrets

---

## Creating GitHub Personal Access Token

GitHub Personal Access Tokens (PAT) are required for repository access and deployment automation.

### Step 1: Navigate to GitHub Settings

1. Open GitHub.com and log in to your account
2. Click your **profile icon** in the top-right corner
3. Select **Settings** from the dropdown menu

**Direct URL**: https://github.com/settings/profile

### Step 2: Access Developer Settings

1. In the left sidebar, scroll down and click **Developer settings**
2. Click **Personal access tokens** → **Tokens (classic)**

**Direct URL**: https://github.com/settings/tokens

### Step 3: Create New Token

1. Click **Generate new token** → **Generate new token (classic)**
2. In the **Note** field, enter: `Transcend SSP GitHub Actions Deployment`
3. Set **Expiration** to **90 days** (recommended for security)

### Step 4: Select Required Scopes

Check the following scopes for your token:

```
✓ repo (Full control of private repositories)
  ✓ repo:status
  ✓ repo_deployment
  ✓ public_repo
  ✓ repo:invite
  
✓ workflow (Update GitHub Action workflows)

✓ read:org (Read organization information)

✓ admin:repo_hook (Full control of repository hooks)
  ✓ write:repo_hook
  ✓ read:repo_hook

✓ user:email (Access user email addresses)
```

### Step 5: Generate and Save Token

1. Scroll to the bottom and click **Generate token**
2. **IMPORTANT**: Copy the token immediately and save it securely
   - Store in a password manager (1Password, LastPass, etc.)
   - Do NOT commit to git or share via email
   - You cannot retrieve this token later

**Token Format Example**:
```
ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Adding GITHUB_TOKEN Secret

Repository secrets allow workflows to access the token securely without exposing it in code.

### Step 1: Navigate to Repository Secrets

1. Go to your repository: https://github.com/jbconsultingassociatesinc/transcend-ssp
2. Click **Settings** (top tab)
3. In the left sidebar, click **Secrets and variables** → **Actions**

**Direct URL**: 
```
https://github.com/jbconsultingassociatesinc/transcend-ssp/settings/secrets/actions
```

### Step 2: Create New Repository Secret

1. Click **New repository secret** button
2. In **Name** field, enter: `GITHUB_TOKEN`
3. In **Value** field, paste your personal access token (from Step 5 above)
4. Click **Add secret**

### Step 3: Create Additional Secrets

Add these secrets following the same process:

#### For Deployment Notifications

```
Secret Name: DEPLOYMENT_WEBHOOK_URL
Value: <your-webhook-endpoint-url>
Description: Webhook URL for deployment notifications
```

#### For Deployment Token (Optional)

```
Secret Name: DEPLOYMENT_TOKEN
Value: <deployment-environment-token>
Description: Authentication token for deployment server
```

#### For Environment Variables

```
Secret Name: PRODUCTION_API_URL
Value: <production-api-endpoint>
Description: Production API endpoint for deployments

Secret Name: STAGING_API_URL
Value: <staging-api-endpoint>
Description: Staging API endpoint for test deployments
```

### Step 4: Verify Secrets

1. Return to **Secrets and variables** → **Actions**
2. You should see your created secrets listed (masked with dots)
3. Click the three-dots menu next to a secret to update or delete

---

## Setting DEPLOYMENT_WEBHOOK_URL

The webhook URL enables GitHub Actions to notify your deployment system of workflow completion.

### Step 1: Prepare Your Webhook Endpoint

Your deployment system must have a POST endpoint that accepts webhook notifications:

```
Endpoint URL: https://your-deployment-server.com/webhooks/github
Method: POST
Content-Type: application/json
```

### Step 2: Webhook Payload Structure

GitHub Actions will POST this JSON payload:

```json
{
  "action": "deployment_complete",
  "status": "success",
  "workflow_name": "Deploy to Production",
  "run_id": 1234567890,
  "commit_sha": "abc123def456",
  "branch": "main",
  "timestamp": "2026-08-14T10:30:00Z",
  "deployment_url": "https://github.com/jbconsultingassociatesinc/transcend-ssp/actions/runs/1234567890"
}
```

### Step 3: Secure Your Webhook

1. **Generate a Webhook Secret**: Create a random string for authentication
   ```bash
   openssl rand -hex 32
   # Output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
   ```

2. **Add Webhook Secret to Repository**:
   - Follow steps from "Adding GITHUB_TOKEN Secret"
   - Create new secret: `WEBHOOK_SECRET`
   - Value: the random string from above

### Step 4: Configure Webhook Authentication

In your deployment endpoint, validate the webhook signature:

```python
# Example: Python/Flask
import hmac
import hashlib
from flask import request

def verify_webhook_signature(payload_body, signature, secret):
    expected_signature = 'sha256=' + hmac.new(
        secret.encode(),
        payload_body.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected_signature)

@app.route('/webhooks/github', methods=['POST'])
def github_webhook():
    signature = request.headers.get('X-Hub-Signature-256')
    payload_body = request.get_data(as_text=True)
    secret = os.environ['WEBHOOK_SECRET']
    
    if not verify_webhook_signature(payload_body, signature, secret):
        return {'error': 'Invalid signature'}, 401
    
    data = request.json
    # Process deployment notification
    return {'status': 'received'}, 200
```

### Step 5: Add to GitHub Actions Workflow

Update your workflow file (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run deployment
        run: |
          npm install
          npm run build
          npm run deploy
      
      - name: Notify deployment webhook
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const https = require('https');
            const crypto = require('crypto');
            
            const payload = JSON.stringify({
              action: 'deployment_complete',
              status: context.job.status,
              workflow_name: context.workflow,
              run_id: context.runId,
              commit_sha: context.sha,
              branch: context.ref.replace('refs/heads/', ''),
              timestamp: new Date().toISOString(),
              deployment_url: context.serverUrl + '/' + context.repository + '/actions/runs/' + context.runId
            });
            
            const secret = process.env.WEBHOOK_SECRET;
            const signature = 'sha256=' + crypto
              .createHmac('sha256', secret)
              .update(payload)
              .digest('hex');
            
            const options = {
              hostname: new URL(process.env.DEPLOYMENT_WEBHOOK_URL).hostname,
              path: new URL(process.env.DEPLOYMENT_WEBHOOK_URL).pathname,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': payload.length,
                'X-Hub-Signature-256': signature
              }
            };
            
            await new Promise((resolve, reject) => {
              const req = https.request(options, (res) => {
                res.on('data', () => {});
                res.on('end', resolve);
              });
              req.on('error', reject);
              req.write(payload);
              req.end();
            });
        env:
          DEPLOYMENT_WEBHOOK_URL: ${{ secrets.DEPLOYMENT_WEBHOOK_URL }}
          WEBHOOK_SECRET: ${{ secrets.WEBHOOK_SECRET }}
```

---

## Configuring GitHub Repository Permissions

GitHub repository permissions control who can approve and run deployments.

### Step 1: Navigate to Repository Protection Rules

1. Go to repository: https://github.com/jbconsultingassociatesinc/transcend-ssp
2. Click **Settings** tab
3. In left sidebar, click **Branches**
4. Click **Add rule** under "Branch protection rules"

**Direct URL**:
```
https://github.com/jbconsultingassociatesinc/transcend-ssp/settings/branches
```

### Step 2: Configure Branch Protection

1. **Branch name pattern**: Enter `main`
2. Check the following options:
   ```
   ✓ Require a pull request before merging
     ✓ Require status checks to pass before merging
     ✓ Require branches to be up to date before merging
   ✓ Require code reviews before merging
     - Required number of reviewers: 1
     ✓ Require review from Code Owners
   ✓ Restrict who can push to matching branches
     - Allow specified actors to bypass required status checks
   ✓ Allow force pushes
     - Specify who can force push: None (disable)
   ✓ Allow deletions
   ```

### Step 3: Configure Deployment Environments

1. In left sidebar, click **Environments**
2. Click **New environment**
3. Create environments for `production` and `staging`

**For Production Environment**:

1. Name: `production`
2. Click **Create environment**
3. Configure protection rules:
   - Check **Require reviewers**
   - Add required reviewers (team members)
   - Set **Prevent self-review**: ON
4. Add environment secrets:
   - `PRODUCTION_API_URL`
   - `PRODUCTION_DEPLOYMENT_TOKEN`

**For Staging Environment**:

1. Name: `staging`
2. Click **Create environment**
3. Keep default settings (no reviewer requirement)
4. Add environment secrets:
   - `STAGING_API_URL`
   - `STAGING_DEPLOYMENT_TOKEN`

### Step 4: Set Workflow Permissions

1. Go to **Settings** → **Actions** → **General**
2. Under "Workflow permissions":
   ```
   ✓ Read and write permissions
   ✓ Allow GitHub Actions to create and approve pull requests
   ```

**Direct URL**:
```
https://github.com/jbconsultingassociatesinc/transcend-ssp/settings/actions/general
```

---

## Testing Workflow Trigger Manually

Manual workflow dispatch allows testing without pushing code changes.

### Step 1: Create Workflow File

Create `.github/workflows/manual-test.yml`:

```yaml
name: Manual Test Deployment

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
      verbose:
        description: 'Enable verbose logging'
        required: false
        type: boolean

jobs:
  test-deployment:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Run tests
        run: npm test
      
      - name: Deploy to ${{ github.event.inputs.environment }}
        run: |
          if [[ "${{ github.event.inputs.verbose }}" == "true" ]]; then
            npm run deploy -- --verbose --environment=${{ github.event.inputs.environment }}
          else
            npm run deploy -- --environment=${{ github.event.inputs.environment }}
          fi
        env:
          DEPLOYMENT_TOKEN: ${{ secrets.DEPLOYMENT_TOKEN }}
          API_URL: ${{ secrets[format('{0}_API_URL', github.event.inputs.environment == 'production' && 'PRODUCTION' || 'STAGING')] }}
      
      - name: Verify deployment
        run: npm run verify -- --environment=${{ github.event.inputs.environment }}
      
      - name: Notify deployment complete
        if: success()
        uses: actions/github-script@v7
        with:
          script: |
            core.notice('Deployment to ${{ github.event.inputs.environment }} completed successfully!')
```

### Step 2: Trigger Manual Workflow

1. Go to repository: https://github.com/jbconsultingassociatesinc/transcend-ssp
2. Click **Actions** tab
3. In left sidebar, click **Manual Test Deployment**
4. Click **Run workflow** button
5. Select options:
   - **Environment**: staging (for initial test)
   - **Verbose logging**: enabled
6. Click **Run workflow** button again

**Direct URL**:
```
https://github.com/jbconsultingassociatesinc/transcend-ssp/actions/workflows/manual-test.yml
```

### Step 3: Monitor Workflow Execution

1. Workflow will appear at top of runs list
2. Click on the workflow run
3. View step-by-step output
4. Check logs for errors or warnings

---

## Monitoring Workflow Runs

GitHub Actions provides detailed logs and metrics for all workflow executions.

### Step 1: Access Workflow Runs

1. Go to repository: https://github.com/jbconsultingassociatesinc/transcend-ssp
2. Click **Actions** tab
3. Select workflow from left sidebar

**All Workflows URL**:
```
https://github.com/jbconsultingassociatesinc/transcend-ssp/actions
```

### Step 2: View Run Details

1. Click on any workflow run
2. See summary at top:
   - Status (✓ Success, ✗ Failed, ⏱ In Progress)
   - Duration and timestamp
   - Commit SHA and branch
   - Triggered by (user/webhook)

### Step 3: Review Job Logs

1. Click on a job (e.g., "deploy")
2. Expand steps to view logs:
   ```
   ► Checkout code
   ► Set up Node.js
   ► Install dependencies
   ► Build application
   ► Run tests
   ► Deploy
   ► Verify deployment
   ```
3. Click on any step to see detailed output

### Step 4: Enable Workflow Status Badge

Add to repository README.md:

```markdown
## Build Status

![Deploy to Production](https://github.com/jbconsultingassociatesinc/transcend-ssp/actions/workflows/deploy.yml/badge.svg?branch=main)

![Deploy to Staging](https://github.com/jbconsultingassociatesinc/transcend-ssp/actions/workflows/deploy.yml/badge.svg?branch=staging)
```

### Step 5: Set Up Notifications

1. Go to your GitHub settings: https://github.com/settings/notifications
2. Under "GitHub Actions":
   - Check **Notifications for workflow runs** (recommended)
   - Select notification preference (email or web)

3. Watch repository for notifications:
   - Go to repository **Settings** → **Notifications**
   - Enable notifications for workflow failures

---

## Debugging Failed Deployments

When workflows fail, systematic debugging is essential.

### Step 1: Review Failure Summary

1. Go to failed workflow run
2. Note the failed job and step
3. Look for red error indicators

**Common Failure Patterns**:

```
✗ Build failed
  → npm install or npm run build failed
  → Check package.json and dependencies

✗ Tests failed
  → Unit tests, integration tests, or E2E tests
  → Check test output for specific failures

✗ Deployment failed
  → Authentication issues
  → Network connectivity problems
  → Invalid environment configuration

✗ Verification failed
  → Application didn't start
  → Health checks failed
  → Environment variables missing
```

### Step 2: Examine Detailed Logs

1. Click the failed step to expand it
2. Search logs for error keywords:
   ```
   error
   failed
   exit code 1
   404
   401
   timeout
   ```

3. Note the exact error message
4. Look for stack traces or specific file references

### Step 3: Check Environment Variables

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Verify all required secrets are present:
   ```
   GITHUB_TOKEN
   DEPLOYMENT_WEBHOOK_URL
   DEPLOYMENT_TOKEN
   PRODUCTION_API_URL
   STAGING_API_URL
   ```
3. Ensure secrets haven't expired (especially API tokens)

### Step 4: Test Locally

Reproduce the failure locally before re-running:

```bash
# Clone repository
git clone https://github.com/jbconsultingassociatesinc/transcend-ssp
cd transcend-ssp

# Install dependencies
npm ci

# Run same commands as workflow
npm run build
npm test
npm run deploy -- --environment=staging

# Check deployment
npm run verify -- --environment=staging
```

### Step 5: Debug with Workflow Logs

Enable debug logging in GitHub Actions:

1. Add secret to repository:
   - Name: `ACTIONS_STEP_DEBUG`
   - Value: `true`

2. Re-run failed workflow
3. Detailed debug logs will appear in all steps

### Step 6: Common Issues and Solutions

#### Issue: Authentication Failed (401)

```
Error: Unauthorized (401)
Problem: Invalid or expired token
Solution:
1. Go to Secrets → GITHUB_TOKEN
2. Generate new personal access token
3. Update secret value
4. Re-run workflow
```

#### Issue: Build Failed - Node Modules

```
Error: Cannot find module 'package-name'
Problem: Dependencies not installed
Solution:
1. Check package-lock.json is committed
2. Use 'npm ci' instead of 'npm install'
3. Clear npm cache: npm cache clean --force
4. Re-run workflow
```

#### Issue: Deployment Webhook Timeout

```
Error: Request timeout after 30s
Problem: Webhook endpoint unresponsive
Solution:
1. Verify webhook URL is correct
2. Check deployment server is running
3. Test webhook endpoint manually:
   curl -X POST https://your-webhook-url
4. Increase timeout in workflow if needed
```

#### Issue: Environment Variable Missing

```
Error: PRODUCTION_API_URL is undefined
Problem: Secret not set for environment
Solution:
1. Go to Settings → Environments → production
2. Click "Add secret"
3. Create PRODUCTION_API_URL secret
4. Verify environment name matches workflow
```

#### Issue: Permission Denied on Push

```
Error: Permission denied (publickey)
Problem: SSH key not available in runner
Solution:
1. Use GitHub token authentication
2. In deploy step, set git config:
   git config --global credential.helper store
   echo "https://token:$GITHUB_TOKEN@github.com" > ~/.git-credentials
3. Re-run workflow
```

### Step 7: Re-run Failed Workflow

1. Go to failed workflow run
2. Click **Re-run jobs** button (top-right)
3. Select **Re-run failed jobs** (to skip passed steps)
4. Or **Re-run all jobs** (to run from scratch)
5. Monitor new run

### Step 8: View Workflow Artifacts

Some workflows may generate artifacts (build outputs, logs):

1. In workflow run, scroll to bottom
2. Look for "Artifacts" section
3. Download build logs or deployment reports
4. Analyze for root cause

---

## Security Best Practices

### Token Management

1. **Rotate tokens regularly**
   - Set 90-day expiration on personal access tokens
   - Create calendar reminder to rotate
   - Generate new token before expiration

2. **Use minimal scopes**
   ```
   Good: repo, workflow, read:org, admin:repo_hook
   Bad: Full access to all scopes
   ```

3. **Revoke exposed tokens immediately**
   - Go to GitHub Settings → Developer settings → Tokens
   - Find exposed token and click **Delete**
   - Rotate affected environment immediately

### Webhook Security

1. **Always use HTTPS**
   ```
   Good: https://your-deployment-server.com/webhooks/github
   Bad: http://your-deployment-server.com/webhooks/github
   ```

2. **Validate webhook signatures**
   - Every webhook should verify the `X-Hub-Signature-256` header
   - Use secure comparison (avoid timing attacks)
   - Log failed signature validations

3. **Implement rate limiting**
   ```
   - Max 100 webhook requests per minute per IP
   - Implement exponential backoff for retries
   - Monitor for suspicious webhook patterns
   ```

### Secrets Management

1. **Never commit secrets**
   ```bash
   # Bad - don't do this
   echo "GITHUB_TOKEN=ghp_xxxxx" > .env
   git add .env
   
   # Good - use GitHub secrets
   GITHUB_TOKEN stored in Settings → Secrets
   ```

2. **Use environment-specific secrets**
   ```
   Production: PRODUCTION_API_URL
   Staging: STAGING_API_URL
   Development: LOCAL_API_URL
   ```

3. **Audit secret access**
   - Review who has access to secrets
   - Check environment protection rules
   - Require approval for production deployments

### Workflow Security

1. **Specify actions versions**
   ```yaml
   # Good - pinned to specific version
   - uses: actions/checkout@v4
   
   # Bad - uses latest (unpredictable)
   - uses: actions/checkout@latest
   ```

2. **Review third-party actions**
   - Only use trusted, verified actions
   - Check action source code on GitHub
   - Monitor for security advisories

3. **Limit workflow permissions**
   ```yaml
   permissions:
     contents: read
     deployments: write
     pull-requests: write
   ```

4. **Use environment protection rules**
   - Require approvals for production
   - Restrict deployment branches
   - Enable deployment protection

### Monitoring and Auditing

1. **Enable audit logging**
   - Go to Settings → Audit log
   - Monitor for unauthorized access
   - Archive logs for compliance

2. **Set up notifications**
   - Email alerts for workflow failures
   - Slack integration for deployment status
   - PagerDuty for critical failures

3. **Review deploy history**
   - Check who triggered deployments
   - Verify deployment status regularly
   - Keep deployment records for compliance

---

## Troubleshooting

### FAQ and Common Issues

#### Q: Can I reuse the same token for multiple repositories?

**A**: Yes, but it's not recommended. Best practice is to create separate tokens with minimal scope for each repository. This limits exposure if a token is compromised.

#### Q: How long do workflow runs take?

**A**: Most runs take 5-10 minutes. Times depend on:
- Build complexity
- Test coverage
- Network latency
- Deployment size
- Enable caching to speed up repeated builds

#### Q: Can I rollback a failed deployment?

**A**: Yes. Create a rollback workflow:

```yaml
name: Rollback Deployment

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to rollback'
        required: true
        type: choice
        options: [staging, production]
      target_commit:
        description: 'Commit SHA to rollback to'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.target_commit }}
      
      - name: Deploy rollback
        run: npm run deploy -- --environment=${{ github.event.inputs.environment }}
        env:
          DEPLOYMENT_TOKEN: ${{ secrets.DEPLOYMENT_TOKEN }}
```

#### Q: How do I test my workflow locally?

**A**: Use Act, a local GitHub Actions runner:

```bash
# Install act
brew install act

# List workflows
act --list

# Run specific workflow
act -j test-deployment

# Run with secrets
act -j test-deployment --secret-file .env.secrets
```

#### Q: Can I skip a workflow run?

**A**: Yes. Include `[skip ci]` in commit message:

```bash
git commit -m "Update docs [skip ci]"
git push
```

The workflow will be skipped.

#### Q: How do I access secrets in a workflow?

**A**: Use `secrets` context variable:

```yaml
- name: Deploy
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    API_URL: ${{ secrets.PRODUCTION_API_URL }}
  run: npm run deploy
```

Secrets are masked in logs (shown as `***`).

#### Q: Can I schedule deployments?

**A**: Yes, use cron schedule:

```yaml
on:
  schedule:
    # Run at 2 AM UTC daily
    - cron: '0 2 * * *'
```

#### Q: How do I get notifications?

**A**: 
1. GitHub email (Settings → Notifications)
2. GitHub web notifications (bell icon)
3. Slack integration (GitHub App)
4. PagerDuty (critical deployments)
5. Custom webhooks

#### Q: Can I cancel a running workflow?

**A**: Yes:
1. Go to workflow run
2. Click **Cancel workflow** (top-right)
3. Workflow will stop after current step

---

## Quick Reference

### Essential URLs

```
GitHub Settings:           https://github.com/settings/profile
Personal Access Tokens:    https://github.com/settings/tokens
Repository Secrets:        https://github.com/jbconsultingassociatesinc/transcend-ssp/settings/secrets/actions
Branch Protection:         https://github.com/jbconsultingassociatesinc/transcend-ssp/settings/branches
Environments:              https://github.com/jbconsultingassociatesinc/transcend-ssp/settings/environments
Workflow Runs:             https://github.com/jbconsultingassociatesinc/transcend-ssp/actions
Audit Log:                 https://github.com/jbconsultingassociatesinc/transcend-ssp/settings/audit-log
```

### Required Secrets

```
GITHUB_TOKEN              - Personal access token for authentication
DEPLOYMENT_WEBHOOK_URL    - Webhook endpoint for notifications
DEPLOYMENT_TOKEN          - Token for deployment server
PRODUCTION_API_URL        - Production API endpoint
STAGING_API_URL           - Staging API endpoint
WEBHOOK_SECRET            - Secret for webhook signature validation
```

### Token Scopes

```
repo                  - Full control of repositories
workflow              - Update GitHub Action workflows
read:org              - Read organization information
admin:repo_hook       - Full control of repository hooks
user:email            - Access user email addresses
```

### Common Workflow Commands

```yaml
# Checkout code
uses: actions/checkout@v4

# Setup Node.js
uses: actions/setup-node@v4
with:
  node-version: '18'

# Run script
run: npm run build

# Set environment variable
env:
  NODE_ENV: production

# Create output
run: echo "::set-output name=status::success"

# Add annotation
run: echo "::notice::Deployment complete"

# Handle errors
if: failure()
```

---

## Support and Additional Resources

- **GitHub Actions Documentation**: https://docs.github.com/en/actions
- **GitHub Actions Security**: https://docs.github.com/en/actions/security-guides
- **GitHub API Reference**: https://docs.github.com/en/rest
- **GitHub Webhook Events**: https://docs.github.com/en/developers/webhooks-and-events

For issues or questions:
1. Check GitHub Actions logs for detailed error messages
2. Review this troubleshooting section
3. Contact your deployment team lead
4. Open issue in repository with workflow name and run ID

---

**Document Version**: 1.0  
**Last Updated**: 2026-08-14  
**Maintained By**: Development Team  
**Status**: Production Ready
