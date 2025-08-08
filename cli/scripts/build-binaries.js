#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const platforms = [
  { name: 'linux-x64', target: 'node18-linux-x64' },
  { name: 'macos-x64', target: 'node18-macos-x64' },
  { name: 'macos-arm64', target: 'node18-macos-arm64' },
  { name: 'windows-x64', target: 'node18-win-x64' },
];

const distDir = path.join(__dirname, '..', 'dist-binaries');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log('🔨 Building CLI binaries...');

// Build TypeScript first
console.log('📦 Building TypeScript...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} catch (error) {
  console.error('❌ TypeScript build failed');
  process.exit(1);
}

// Check if pkg is installed
try {
  execSync('pkg --version', { stdio: 'pipe' });
} catch (error) {
  console.log('📦 Installing pkg...');
  execSync('npm install -g pkg', { stdio: 'inherit' });
}

platforms.forEach(platform => {
  console.log(`🏗️  Building for ${platform.name}...`);
  
  const outputName = platform.name.includes('windows') ? 'tolstoy.exe' : 'tolstoy';
  const outputPath = path.join(distDir, platform.name, outputName);
  
  // Create platform directory
  const platformDir = path.join(distDir, platform.name);
  if (!fs.existsSync(platformDir)) {
    fs.mkdirSync(platformDir, { recursive: true });
  }

  try {
    execSync(
      `pkg dist/cli.js --target ${platform.target} --output "${outputPath}"`,
      { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      }
    );
    
    console.log(`✅ ${platform.name} binary created: ${outputPath}`);
  } catch (error) {
    console.error(`❌ Failed to build ${platform.name} binary:`, error.message);
  }
});

// Create archive files
console.log('📦 Creating archive files...');

platforms.forEach(platform => {
  const platformDir = path.join(distDir, platform.name);
  const archiveName = `tolstoy-cli-${platform.name}`;
  
  if (fs.existsSync(platformDir)) {
    try {
      if (platform.name.includes('windows')) {
        // Create ZIP for Windows
        execSync(
          `cd "${distDir}" && zip -r "${archiveName}.zip" "${platform.name}"`,
          { stdio: 'inherit' }
        );
      } else {
        // Create tar.gz for Unix-like systems
        execSync(
          `cd "${distDir}" && tar -czf "${archiveName}.tar.gz" "${platform.name}"`,
          { stdio: 'inherit' }
        );
      }
      console.log(`✅ Archive created for ${platform.name}`);
    } catch (error) {
      console.error(`❌ Failed to create archive for ${platform.name}:`, error.message);
    }
  }
});

console.log('🎉 Binary builds complete!');
console.log(`📁 Binaries available in: ${distDir}`);