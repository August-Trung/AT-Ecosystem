import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures assets are loaded correctly relative to the index.html
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});