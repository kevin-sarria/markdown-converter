/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this repo at /markdown-converter/, not the domain root,
  // so asset URLs need that prefix in the production build (dev server stays at /).
  base: command === 'build' ? '/markdown-converter/' : '/',
  plugins: [react(), tailwindcss()],
  // jsdom, not node: the round-trip these tests guard runs through Turndown,
  // which reads the document the same way it does in the browser. Testing it
  // against a real DOM is the only way the test matches what users hit.
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
}))
