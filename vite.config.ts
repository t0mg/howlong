import { defineConfig } from 'vite';

export default defineConfig({
  base: '/howlong/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
