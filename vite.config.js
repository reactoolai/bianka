import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        equipe: resolve(__dirname, 'equipe.html'),
        services: resolve(__dirname, 'services.html'),
        'services-personnalises': resolve(__dirname, 'services-personnalises.html'),
        engagement: resolve(__dirname, 'engagement.html'),
        rendezvous: resolve(__dirname, 'rendez-vous.html'),
        bianka: resolve(__dirname, 'bianka.html'),
        alexandre: resolve(__dirname, 'alexandre.html'),
      },
    },
  },
});
