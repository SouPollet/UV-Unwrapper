import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['xatlasjs']
  },
  server: {
    fs: {
      strict: false // allow serving from node_modules
    }
  }
});
