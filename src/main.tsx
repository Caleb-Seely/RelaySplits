import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import ErrorBoundary from '@/components/ErrorBoundary';
import { initLogging } from '@/utils/logger';

// Initialize logging (no-op unless VITE_SENTRY_DSN is set)
initLogging();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
