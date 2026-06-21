import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // React is a peer dependency — never bundle it.
  external: ['react', 'react-dom', 'react/jsx-runtime'],
})
