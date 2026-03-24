import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Força limpeza de Service Workers antigos e caches obsoletos
const cleanupAndRender = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        // Força atualização de cada SW registrado
        await registration.update();
      }
    } catch {
      // Silenciar erros
    }
  }

  // Limpa caches expirados
  if ('caches' in window) {
    try {
      const names = await caches.keys();
      for (const name of names) {
        if (name.includes('workbox-precache') || name.includes('supabase-cache')) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          for (const key of keys) {
            await cache.delete(key);
          }
        }
      }
    } catch {
      // Silenciar erros
    }
  }

  createRoot(document.getElementById("root")!).render(<App />);
};

cleanupAndRender();
