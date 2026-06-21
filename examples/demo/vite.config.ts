import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Project pages live at https://<org>.github.io/openglass/ — set the base so
// assets resolve under that subpath. Override with `--base=/` for local builds.
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
