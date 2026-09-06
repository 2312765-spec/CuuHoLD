// @ts-check
import eslint from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'dev-dist/**', 'coverage/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // 'flat/essential' (không phải 'flat/recommended') — chỉ bật rule bắt lỗi thật
  // (key trong v-for, side-effect trong computed...), không kéo theo lớp rule thuần
  // định dạng (xuống dòng attribute, tự self-closing thẻ...) — dự án chưa có Prettier
  // cho frontend nên không áp áp đặt style riêng của eslint-plugin-vue lên code đã có.
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Mục 4 CLAUDE.md: NEVER use 'any', luôn <script setup lang="ts">
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'vue/multi-word-component-names': 'off',
      'vue/block-lang': [
        'error',
        { script: { lang: 'ts' } },
      ],
      'vue/component-api-style': ['error', ['script-setup']],
    },
  },
);
