import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: './frontend',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      '/api': 'http://localhost:8000'
    }
  }
})
