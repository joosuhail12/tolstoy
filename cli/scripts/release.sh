#!/bin/bash
set -e

echo "🚀 Starting Tolstoy CLI Release Process"

# Check if we're on main branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
    echo "❌ Must be on main branch to release. Current branch: $BRANCH"
    exit 1
fi

# Check if working directory is clean
if [[ -n $(git status --porcelain) ]]; then
    echo "❌ Working directory is not clean. Please commit or stash changes."
    git status --short
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: $CURRENT_VERSION"

# Prompt for new version
echo "📝 Enter new version (current: $CURRENT_VERSION):"
read NEW_VERSION

if [ -z "$NEW_VERSION" ]; then
    echo "❌ No version provided. Exiting."
    exit 1
fi

# Validate version format (basic semver check)
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
    echo "❌ Invalid version format. Please use semver format (e.g., 1.2.3 or 1.2.3-beta.1)"
    exit 1
fi

echo "🔄 Updating version to $NEW_VERSION"

# Update package.json version
npm version $NEW_VERSION --no-git-tag-version

# Run tests
echo "🧪 Running tests..."
npm test || {
    echo "❌ Tests failed. Aborting release."
    git checkout package.json
    exit 1
}

# Build the project
echo "🔨 Building project..."
npm run build || {
    echo "❌ Build failed. Aborting release."
    git checkout package.json
    exit 1
}

# Build binaries
echo "🏗️  Building binaries..."
node scripts/build-binaries.js || {
    echo "❌ Binary build failed. Aborting release."
    git checkout package.json
    exit 1
}

# Commit version bump
echo "📝 Committing version bump..."
git add package.json package-lock.json
git commit -m "chore: bump version to $NEW_VERSION"

# Create git tag
echo "🏷️  Creating git tag..."
git tag "v$NEW_VERSION"

# Push to remote
echo "📤 Pushing to remote..."
git push origin main
git push origin "v$NEW_VERSION"

# Publish to npm
echo "📦 Publishing to npm..."
npm publish || {
    echo "❌ npm publish failed. Manual intervention may be needed."
    echo "   Tag and commits have already been pushed to remote."
    exit 1
}

echo "🎉 Release $NEW_VERSION completed successfully!"
echo ""
echo "📋 Release Summary:"
echo "   • Version: $NEW_VERSION"
echo "   • Git tag: v$NEW_VERSION"
echo "   • npm package: @tolstoy/cli@$NEW_VERSION"
echo "   • Binaries: Available in dist-binaries/"
echo ""
echo "🔗 Next steps:"
echo "   • Create GitHub release with binaries"
echo "   • Update documentation"
echo "   • Announce the release"