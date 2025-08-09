import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '*.js', 'coverage/**', '.next/**', '*.mjs', '**/*.spec.ts', '**/*.test.ts', 'tests/**/*'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: '.',
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        module: 'writable',
        require: 'readonly',
        global: 'readonly',
        Promise: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        fetch: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettierPlugin,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...prettier.rules,
      
      // TypeScript-specific rules - relaxed for migration
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off', // Temporarily disabled
      '@typescript-eslint/explicit-module-boundary-types': 'off', // Temporarily disabled
      '@typescript-eslint/no-explicit-any': 'off', // Temporarily disabled for migration
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'off', // Requires strictNullChecks
      '@typescript-eslint/prefer-optional-chain': 'off', // Disabled for consistency
      '@typescript-eslint/strict-boolean-expressions': 'off', // Requires strictNullChecks
      '@typescript-eslint/no-unnecessary-type-assertion': 'off', // Disabled for migration
      '@typescript-eslint/no-unnecessary-condition': 'off', // Requires strictNullChecks
      '@typescript-eslint/prefer-readonly': 'off', // Too strict for current migration
      '@typescript-eslint/prefer-readonly-parameter-types': 'off', // Too strict for most cases
      '@typescript-eslint/array-type': ['warn', { default: 'array-simple' }],
      '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
      '@typescript-eslint/consistent-type-imports': 'off', // Temporarily disabled
      '@typescript-eslint/no-import-type-side-effects': 'warn',
      '@typescript-eslint/no-require-imports': 'off', // Temporarily disabled for legacy code
      
      // General code quality rules
      'no-console': 'off', // Keep for logging in backend
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'brace-style': ['warn', '1tbs'],
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'no-trailing-spaces': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      
      // Security and best practices
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'off', // Disabled - used for legitimate template evaluation
      'no-param-reassign': 'warn',
      'no-return-assign': 'error',
      'no-throw-literal': 'error',
      'no-unused-expressions': 'warn',
      'prefer-promise-reject-errors': 'warn',
      'require-await': 'off', // Disabled - many async methods are interface-compliant
      
      // Import/Export consistency
      'no-duplicate-imports': 'error',
      'sort-imports': ['warn', { ignoreDeclarationSort: true }],
      
      // Prettier integration
      'prettier/prettier': 'warn', // Relaxed to warn for migration
    },
  },
  {
    files: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: '.',
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        module: 'writable',
        require: 'readonly',
        global: 'readonly',
        Promise: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        fetch: 'readonly',
        // Jest globals
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettierPlugin,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...prettier.rules,
      
      // More relaxed rules for tests
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn', // More lenient in tests
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'off', // Disabled for consistency
      
      // General rules
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'brace-style': ['warn', '1tbs'],
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'no-trailing-spaces': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'prettier/prettier': 'error',
    },
  },
];