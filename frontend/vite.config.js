import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  plugins: isProd ? [react(), tailwindcss()] : [react(), tailwindcss(), basicSsl()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/auth': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/linkedin': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  define: {
    __API_BASE__: JSON.stringify(process.env.VITE_API_URL || ''),
  },
})
