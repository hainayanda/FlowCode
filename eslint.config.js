import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        fetch: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_' 
      }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/member-ordering': ['error', {
        default: [
          // Static properties first
          'public-static-field',
          'private-static-field',

          // Readonly properties
          'public-readonly-field',
          'private-readonly-field',

          // Instance properties
          'public-instance-field',
          'private-instance-field',
          
          // Public getters
          'public-get',
          'public-set',
          
          // Private getters
          'private-get',
          'private-set',

          // Static methods
          'public-static-method',
          'private-static-method',

          // Constructor
          'constructor',
          
          // Instance methods
          'public-instance-method',
          'private-instance-method'
        ]
      }],
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-console': 'off',
      'no-undef': 'off',
      'no-case-declarations': 'off',
      'no-control-regex': 'off'
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/*.mocks.ts', 'tests/**/*', 'ui-tests/**/*'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off'
    }
  }
];