module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/smoke/**/*.spec.ts'],
  testTimeout: 60000, // allow up to 60s per test
  verbose: true,
  setupFilesAfterEnv: ['<rootDir>/tests/smoke/setup.ts'],
  collectCoverage: false, // smoke tests don't need coverage
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
};