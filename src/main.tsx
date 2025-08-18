import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import ErrorBoundary from '@/components/ErrorBoundary';
import { initLogging } from '@/utils/logger';
import { initializePWA } from '@/utils/serviceWorker';

// Initialize logging (no-op unless VITE_SENTRY_DSN is set)
initLogging();

// Initialize PWA and Service Worker
initializePWA().catch(error => {
  console.warn('Failed to initialize PWA:', error);
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
