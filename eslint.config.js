import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import o1jsPlugin from 'eslint-plugin-o1js';

export default [
  {
    ignores: ['build/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      o1js: o1jsPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      parserOptions: {
        ecmaVersion: 'latest',
      },
    },
    rules: {
      // o1js recommended rules
      'o1js/no-greater-storage-limit-in-circuit': 'error',
      'o1js/no-if-in-circuit': 'error',
      'o1js/no-ternary-in-circuit': 'error',
      'o1js/no-throw-in-circuit': 'error',
      'o1js/no-json-functions-in-circuit': 'error',
      'o1js/no-random-in-circuit': 'error',
      'o1js/no-constructor-in-smart-contract': 'error',
      // Custom rules from old .eslintrc.cjs
      'no-constant-condition': 'off',
      'prefer-const': 'off',
    },
  },
];
