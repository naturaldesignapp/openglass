import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Production demo: https://openglass.vercel.app — base matches the `/openglass/`
// subpath rewrite in vercel.json. Override with `--base=/` for a root deploy.
export default defineConfig({
  base: '/openglass/',
  plugins: [react()],
  resolve: {
    alias: {
      // Dogfood the package's public entry straight from source.
      openglass: resolve(__dirname, '../../src/index.ts'),
    },
  },
})
