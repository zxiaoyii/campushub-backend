import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API is proxied in development so the browser sees one origin and the
// backend needs no CORS setup.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
