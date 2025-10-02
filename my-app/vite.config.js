import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: path.resolve(__dirname, 'frontend'),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  publicDir: path.resolve(__dirname, 'frontend/public'),
  define: {
    'process.env': {},   // ✅ prevents "process is not defined"
  },
  server: {
    proxy: {
      '/realtime': {
        target: 'ws://localhost:3000',  // Proxy to backend WebSocket server
        ws: true,                       // Enable WebSocket proxying
        secure: false,                  // For development (non-https)
        changeOrigin: true              // Adjust origin headers if needed
      }
    }
  }
});