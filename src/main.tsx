import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Limpa caches antigos ao carregar
if ('caches' in window) {
  caches.keys().then(names => {
    names.forEach(name => {
      if (name.includes('workbox-precache') || name.includes('supabase-cache')) {
        caches.open(name).then(cache => {
          cache.keys().then(keys => {
            // Remove entradas expiradas
            keys.forEach(key => cache.delete(key));
          });
        });
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
