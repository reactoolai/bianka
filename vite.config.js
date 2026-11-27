import { resolve } from 'path';
import { readFileSync } from 'fs';
import { defineConfig } from 'vite';

const pages = [
  'index', 'bianka', 'alexandre', 'equipe', 'services',
  'rendez-vous', 'faq', 'contact', 'confidentialite', 'secteurs-desservis', 'admin',
  // anciennes adresses : redirections vers les nouvelles pages
  'services-personnalises', 'engagement',
];

/**
 * Insère le menu et le pied de page partagés dans chaque page.
 *   <!-- @nav bianka -->  → menu, avec la page courante marquée
 *   <!-- @footer -->      → pied de page
 */
function partials() {
  const read = (f) => readFileSync(resolve(__dirname, 'partials', f), 'utf8');
  return {
    name: 'notaires-alma-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace(/<!--\s*@nav\s+([\w-]+)\s*-->/, (_, cur) =>
            read('nav.html').replace(`data-nav="${cur}"`, `data-nav="${cur}" aria-current="page"`))
          .replace(/<!--\s*@footer\s*-->/, () => read('footer.html'));
      },
    },
  };
}

export default defineConfig({
  plugins: [partials()],
  server: { watch: { ignored: ['!**/partials/**'] } },
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(__dirname, `${p}.html`)])),
    },
  },
});
