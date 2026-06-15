import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

// Versão única gerada a cada build (timestamp).
const BUILD_VERSION = String(Date.now());

// Plugin que escreve /version.json (público) em build e em dev,
// permitindo verificação confiável da versão ativa.
function versionJsonPlugin() {
  const payload = JSON.stringify({ version: BUILD_VERSION, builtAt: new Date().toISOString() });
  return {
    name: 'app-version-json',
    buildStart() {
      try {
        fs.mkdirSync(path.resolve(__dirname, 'public'), { recursive: true });
        fs.writeFileSync(path.resolve(__dirname, 'public/version.json'), payload);
      } catch {
        // ignore
      }
    },
    configureServer(server: any) {
      server.middlewares.use('/version.json', (_req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store, must-revalidate');
        res.end(payload);
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    versionJsonPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.png'],
      manifest: {
        name: 'SenexCare',
        short_name: 'SenexCare',
        description: 'Sistema de gerenciamento inteligente para residenciais senior (ILPI)',
        theme_color: '#1e3a2f',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [/^\/(?!api\/).*/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/kvjgmqicictxxfnvhuwl\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5
              },
              networkTimeoutSeconds: 5,
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
