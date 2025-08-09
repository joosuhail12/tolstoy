import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getHello(): string {
    const appName = this.configService.get('APP_NAME', 'Tolstoy');
    return `Hello from ${appName} v1.1.0! 🚀 Now with OAuth2, Metrics & Enhanced Monitoring!`;
  }

  getVersion(): {
    version: string;
    commit: string;
    buildTime: string;
    nodeVersion: string;
    environment: string;
  } {
    // Get version from package.json
    let version = '1.0.0';
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        version = packageJson.version || '1.0.0';
      }
    } catch {
      // Use default version if package.json can't be read
    }

    // Get commit hash from environment or git
    let commit = process.env.COMMIT_HASH || process.env.GITHUB_SHA || 'unknown';
    if (commit === 'unknown') {
      try {
        // Try to get from git
        // Try to get from git using imported execSync
        commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
      } catch {
        // Keep as 'unknown' if git is not available
      }
    }

    // Get build time from environment or current time
    let buildTime = process.env.BUILD_TIME;
    if (!buildTime) {
      try {
        // Try to get from main.js modification time
        const mainJsPath = path.join(process.cwd(), 'dist', 'main.js');
        if (fs.existsSync(mainJsPath)) {
          const stats = fs.statSync(mainJsPath);
          buildTime = stats.mtime.toISOString();
        } else {
          buildTime = new Date().toISOString();
        }
      } catch {
        buildTime = new Date().toISOString();
      }
    }

    return {
      version,
      commit,
      buildTime,
      nodeVersion: process.version,
      environment: this.configService.get('NODE_ENV', 'development'),
    };
  }
}
