import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.eslintrc.js']
  },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': [
        'error',
        {
          ignores: ['Line', 'Entity']
        }
      ],
      'vue/no-mutating-props': 'warn'
    }
  }
)
