import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { letsurLocalPlugin } from './vite/letsur-plugin.ts'

const letsurProxy = {
  '/api': {
    target: 'https://gw.letsur.ai/v1',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api/, ''),
    timeout: 200_000,
    proxyTimeout: 200_000,
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), letsurLocalPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    proxy: letsurProxy,
  },
  preview: {
    proxy: letsurProxy,
  },
})
