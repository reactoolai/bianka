import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        bianka: resolve(__dirname, 'bianka.html'),
        alexandre: resolve(__dirname, 'alexandre.html'),
      },
    },
  },
});
