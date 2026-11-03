import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API is proxied in development so the browser sees one origin and the
// backend needs no CORS setup.
export default defineConfig({
  plugins: [react()],
  // The contract types live in shared/ at the repository root, outside this
  // project, so the alias and the fs.allow entry both have to reach up.
  resolve: {
    alias: {
      '@contract': fileURLToPath(
        new URL('../shared/contract.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
