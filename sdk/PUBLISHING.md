# Publishing @tolstoy/sdk to npm

## Prerequisites

1. **npm Account**: Create an account at [npmjs.com](https://www.npmjs.com/) if you don't have one
2. **Organization Setup**: Create the `@tolstoy` organization on npm (or use your existing org name)

## Publishing Steps

### 1. Login to npm

```bash
cd sdk
npm login
```

Enter your npm credentials when prompted.

### 2. Verify Package Configuration

The package is already configured and ready to publish:
- ✅ Package name: `@tolstoy/sdk@1.0.0`
- ✅ Built and tested successfully
- ✅ All required files included in distribution

### 3. Publish to npm

```bash
npm publish --access public
```

**Expected Output:**
```
npm notice 📦  @tolstoy/sdk@1.0.0
npm notice Tarball Contents
npm notice 116.7kB dist/generated/TolstoyApi.d.ts
... (files listed)
npm notice total files: 14
+ @tolstoy/sdk@1.0.0
```

### 4. Verify Publication

Once published, verify the package is available:

```bash
# Check package info
npm info @tolstoy/sdk

# Test installation
npm install @tolstoy/sdk
```

## Package Details

- **Package Name**: `@tolstoy/sdk`
- **Version**: `1.0.0`
- **Size**: ~26 KB (compressed), ~220 KB (unpacked)
- **Files**: 14 total files including TypeScript declarations
- **License**: MIT
- **Repository**: GitHub (will be auto-corrected to proper format)

## Alternative: Private Registry

If you prefer to keep the SDK private initially, you can:

1. **Remove the `--access public` flag**:
   ```bash
   npm publish
   ```

2. **Or publish to a private registry** (GitHub Packages, etc.)

## Next Steps After Publishing

1. **Update Documentation**: The Mintlify docs already reference `@tolstoy/sdk`
2. **Test Installation**: Verify developers can install and use the SDK
3. **Version Management**: Future updates can be published with version bumps

## Troubleshooting

- **Authentication Issues**: Run `npm whoami` to verify login
- **Organization Access**: Ensure you have publish rights to `@tolstoy` org
- **Package Name Conflicts**: The package name appears to be available

The SDK is production-ready and all tests are passing! 🚀