import fs from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Local dev: the same Express app that runs on Vercel is mounted as Vite middleware,
// so one process and one port serve both the page and /api/*.
function devApi() {
  return {
    name: 'dev-api',
    async configureServer(server) {
      if (fs.existsSync('.env')) process.loadEnvFile('.env')
      const { createApp } = await import('./server/app.js')
      server.middlewares.use(createApp())
    },
  }
}

export default defineConfig({
  root: 'client',
  build: { outDir: '../dist', emptyOutDir: true },
  plugins: [react(), tailwindcss(), devApi()],
})
