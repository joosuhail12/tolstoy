module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: [],
  
  // CI environment optimizations
  maxWorkers: process.env.CI ? 2 : '50%',
  testTimeout: 30000,
  
  // Better error reporting for CI
  verbose: true,
  collectCoverage: process.env.CI ? true : false,
  coverageDirectory: 'coverage',
  coverageReporters: process.env.CI ? ['lcov', 'text-summary'] : ['html', 'text'],
  
  // CI-specific configurations
  forceExit: process.env.CI ? true : false,
  detectOpenHandles: process.env.CI ? false : true,
  
  // Module name mapping for path resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@@/(.*)$': '<rootDir>/$1',
  },
  
  // Global setup for database tests
  globalSetup: process.env.CI ? undefined : undefined,
  globalTeardown: process.env.CI ? undefined : undefined,
  
  // Transform configuration for better compatibility
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],
  
  // Test environment setup
  testEnvironmentOptions: {
    node: {
      experimental: {
        vm: true,
      },
    },
  },
};