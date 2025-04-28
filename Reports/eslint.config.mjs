// eslint.config.mjs
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  {
    ignores: ['**/dist', '.eslintrc.*'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierPlugin,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'true',
      'prettier/prettier': [
        'error',
        {
          usePrettierrc: true,
          printWidth: 100,
          tabWidth: 2,
          trailingComma: 'all',
          singleQuote: true,
        },
      ],
    },
  },
);
