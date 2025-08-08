# Stainless SDK Automation Setup

This repository is configured for automatic SDK generation using Stainless when the OpenAPI specification changes.

## How it works

The GitHub Actions workflow (`.github/workflows/stainless.yml`) automatically:

1. **Preview Builds**: When you create a PR that modifies `docs/openapi.json` or `stainless.yml`, Stainless will generate preview SDKs and comment on the PR with the results
2. **Merge Builds**: When a PR with OpenAPI spec changes is merged to main, Stainless generates and publishes the updated SDKs
3. **Push Builds**: When changes are pushed directly to the main branch, Stainless builds the SDKs

## Setup Required

### 1. Repository Secret Configuration

The workflow uses `STAINLESS_TOKEN` secret which is already configured:

✅ **Secret Name**: `STAINLESS_TOKEN`
✅ **Source**: AWS environment (`tolstoy/env`)
✅ **Status**: Already set up and available to GitHub Actions

### 2. Verify Environment Variables

The workflow uses these environment variables (already configured in the workflow):
- `STAINLESS_ORG`: `pullse-inc`
- `STAINLESS_PROJECT`: `tolstoy-api` 
- `OAS_PATH`: `docs/openapi.json`

## Features

### Build Previews
- Triggered on PRs that modify the OpenAPI spec
- Adds comments to PRs with build results
- Shows diagnostics and potential issues
- Allows testing preview SDKs before merging

### Automatic Builds
- Triggered when PRs are merged or changes pushed to main
- Generates and publishes production SDKs
- Updates all target languages (TypeScript, Python, etc.)

### File Monitoring
The workflow monitors changes to:
- `docs/openapi.json` - Main OpenAPI specification
- `stainless.yml` - Stainless configuration file

## SDK Generation Process

1. **API Changes**: When you modify endpoints, add new features, or update documentation in the API
2. **OpenAPI Update**: The OpenAPI spec is regenerated (usually automatic via NestJS)
3. **PR Creation**: Create a PR with the OpenAPI changes
4. **Preview**: Stainless generates preview SDKs and comments on the PR
5. **Review**: Team reviews the PR and SDK preview
6. **Merge**: When merged, production SDKs are built and published
7. **Distribution**: Updated SDKs are available on npm, PyPI, etc.

## Customization

### Disable Preview Builds
If you want to disable preview builds (they can be noisy), comment out the `preview` job in `.github/workflows/stainless.yml`:

```yaml
jobs:
  # preview:
  #   if: github.event_name == 'pull_request' && github.event.action != 'closed'
  #   ...
```

### Change Monitored Files
To monitor additional files, update the `paths` section:

```yaml
on:
  pull_request:
    paths:
      - 'docs/openapi.json'
      - 'stainless.yml'
      - 'src/**/*.controller.ts'  # Monitor controller changes
```

### Alternative Automation

If you prefer not to use GitHub Actions, you can also:

1. **URL Polling**: Set up Stainless to poll `https://your-api.com/docs/openapi.json` every hour
2. **Manual Triggers**: Use the Stainless CLI or dashboard to trigger builds manually
3. **Webhook Integration**: Set up webhooks to trigger builds on deployment

## Troubleshooting

### Build Failures
- Check the PR comments for Stainless diagnostics
- Verify the OpenAPI spec is valid JSON
- Ensure all new endpoints have proper OpenAPI decorators

### Missing Builds
- Verify `STAINLESS_API_KEY` secret is set correctly
- Check that file paths match the monitored paths
- Ensure the Stainless project exists and you have access

### Preview Comments Not Appearing
- Check repository permissions for the GitHub Action
- Verify the pull request modifies monitored files
- Ensure the workflow has `pull-requests: write` permission

For more help, see the [Stainless documentation](https://docs.stainless.com) or contact the team.