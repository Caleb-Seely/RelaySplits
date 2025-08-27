import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import './index.css'

// Import polyfills first to ensure Node.js modules are available
import '@/utils/polyfills';

import ErrorBoundary from '@/components/ErrorBoundary';
import { initLogging } from '@/utils/logger';
import { initializePWA } from '@/utils/serviceWorker';
import { analytics } from '@/services/analytics';
import { initSentry } from '@/services/sentry';
import { initPerformanceMonitoring, trackResourcePerformance, trackNavigationPerformance } from '@/services/performance';
import { setupGlobalErrorHandling } from '@/utils/errorHandling';

// Initialize crash reporting and performance monitoring first
initSentry();

// Initialize global error handling
setupGlobalErrorHandling();

// Initialize logging (no-op unless VITE_SENTRY_DSN is set)
initLogging();

// Initialize analytics
analytics.init();

// Initialize performance monitoring
initPerformanceMonitoring();
trackResourcePerformance();
trackNavigationPerformance();

// Initialize PWA and Service Worker
initializePWA().catch(error => {
  console.warn('Failed to initialize PWA:', error);
});

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
