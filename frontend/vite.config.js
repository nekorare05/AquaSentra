import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  preview: {
    host: '127.0.0.1', port: 4173, strictPort: true,
    proxy: { '/api': { target: process.env.AQUASENTRA_API_TARGET || 'https://127.0.0.1:8443', changeOrigin: true, secure: false } }
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.AQUASENTRA_API_TARGET || 'https://127.0.0.1:8443',
        changeOrigin: true,
        // LOCAL Vite proxy ONLY: backend uses a locally generated self-signed cert.
        // Never disable certificate verification in production or expose Vite publicly.
        secure: false
      }
    }
  }
});
