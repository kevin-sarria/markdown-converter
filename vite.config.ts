import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this repo at /markdown-converter/, not the domain root,
  // so asset URLs need that prefix in the production build (dev server stays at /).
  base: command === 'build' ? '/markdown-converter/' : '/',
  plugins: [react(), tailwindcss()],
}))
