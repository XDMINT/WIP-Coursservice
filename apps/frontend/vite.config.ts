import { fileURLToPath, URL } from 'url'

/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

// https://vitejs.dev/config/
export default defineConfig({
  css: {
    postcss: {
      plugins: [
        {
          postcssPlugin: 'internal:charset-removal',
          AtRule: {
            charset: (atRule: any) => {
              if (atRule.name === 'charset') {
                atRule.remove()
              }
            }
          }
        }
      ]
    },
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/assets/settings.scss" as *;`
      }
    }
  },
  plugins: [
    vue(),
    vuetify({
      autoImport: true
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: true,
    port: 8085,
    proxy: {
      '/api': {
        target: process.env.INTERNAL_API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  test: {
    server: {
      deps: {
        inline: ['vuetify']
      }
    }
  }
})
