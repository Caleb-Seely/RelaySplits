// Stub Sentry service - provides the same interface but does nothing
// This allows the app to run without the hoist-non-react-statics module resolution issues

// Initialize Sentry (no-op)
export function initSentry() {
  console.log('[Sentry] Stub mode - Sentry is disabled');
}

// Set user context (no-op)
export function setSentryUser(userId: string, userData?: Record<string, any>) {
  // No-op
}

// Set tags (no-op)
export function setSentryTags(tags: Record<string, string>) {
  // No-op
}

// Set context (no-op)
export function setSentryContext(name: string, context: Record<string, any>) {
  // No-op
}

// Capture error (no-op)
export function captureSentryError(
  error: Error | string, 
  context?: Record<string, any>,
  tags?: Record<string, string>
) {
  console.warn('[Sentry] Error captured (stub mode):', error);
  return null;
}

// Capture message (no-op)
export function captureSentryMessage(
  message: string, 
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: Record<string, any>
) {
  console.log(`[Sentry] Message captured (stub mode): ${message}`);
}

// Start transaction (no-op)
export function startSentryTransaction(
  name: string,
  operation: string,
  tags?: Record<string, string>
) {
  return null;
}

// Add breadcrumb (no-op)
export function addSentryBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
) {
  // No-op
}

// Export Sentry object for compatibility
export const Sentry = {
  init: () => console.log('[Sentry] Stub mode - Sentry is disabled'),
  setUser: () => {},
  setTag: () => {},
  setContext: () => {},
  captureException: () => null,
  captureMessage: () => null,
  startTransaction: () => null,
  addBreadcrumb: () => {},
  getCurrentHub: () => ({
    configureScope: (fn: any) => fn({ setSpan: () => {} })
  }),
};
