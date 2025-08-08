#!/bin/bash

# Validate OpenAPI specification for Stainless builds
set -e

echo "🔍 Validating OpenAPI specification..."

# Check if OpenAPI spec file exists
if [ ! -f "docs/openapi.json" ]; then
  echo "❌ OpenAPI spec not found at docs/openapi.json"
  exit 1
fi

# Check if it's valid JSON
if ! jq empty docs/openapi.json >/dev/null 2>&1; then
  echo "❌ OpenAPI spec is not valid JSON"
  exit 1
fi

# Check required fields
OPENAPI_VERSION=$(jq -r '.openapi // empty' docs/openapi.json)
if [ -z "$OPENAPI_VERSION" ]; then
  echo "❌ Missing openapi version field"
  exit 1
fi

# Check for paths
PATHS_COUNT=$(jq '.paths | length' docs/openapi.json)
if [ "$PATHS_COUNT" -eq 0 ]; then
  echo "❌ No API paths found in OpenAPI spec"
  exit 1
fi

# Check for new authentication endpoints
AUTH_ENDPOINTS=0

# Check for tool auth endpoints
if jq -e '.paths["/tools/{toolId}/auth"]' docs/openapi.json >/dev/null 2>&1; then
  echo "✅ Tool auth endpoint found"
  AUTH_ENDPOINTS=$((AUTH_ENDPOINTS + 1))
fi

# Check for OAuth endpoints
if jq -e '.paths | to_entries[] | select(.key | contains("/auth/") and contains("/login"))' docs/openapi.json >/dev/null 2>&1; then
  echo "✅ OAuth login endpoint found"
  AUTH_ENDPOINTS=$((AUTH_ENDPOINTS + 1))
fi

if jq -e '.paths | to_entries[] | select(.key | contains("/auth/") and contains("/callback"))' docs/openapi.json >/dev/null 2>&1; then
  echo "✅ OAuth callback endpoint found"
  AUTH_ENDPOINTS=$((AUTH_ENDPOINTS + 1))
fi

# Check for action execution endpoint
if jq -e '.paths | to_entries[] | select(.key | contains("/actions/") and contains("/execute"))' docs/openapi.json >/dev/null 2>&1; then
  echo "✅ Action execution endpoint found"
  AUTH_ENDPOINTS=$((AUTH_ENDPOINTS + 1))
fi

echo "📊 Validation Summary:"
echo "   OpenAPI Version: $OPENAPI_VERSION"
echo "   Total Endpoints: $PATHS_COUNT"
echo "   New Auth Features: $AUTH_ENDPOINTS/4"

if [ "$AUTH_ENDPOINTS" -eq 4 ]; then
  echo "✅ All new authentication features are documented in OpenAPI spec"
else
  echo "⚠️  Some new authentication endpoints may be missing from OpenAPI spec"
fi

# Check Stainless config
if [ -f "stainless.yml" ]; then
  echo "✅ Stainless configuration found"
  
  # Validate YAML syntax
  if command -v yq >/dev/null 2>&1; then
    if yq eval '.' stainless.yml >/dev/null 2>&1; then
      echo "✅ Stainless config is valid YAML"
    else
      echo "❌ Stainless config has invalid YAML syntax"
      exit 1
    fi
  fi
else
  echo "❌ Stainless configuration not found at stainless.yml"
  exit 1
fi

echo "✅ OpenAPI specification validation completed successfully!"
echo ""
echo "🚀 Ready for Stainless SDK generation!"
echo "   - Create a PR to trigger preview builds"
echo "   - Merge to main to trigger production builds"