// Lightweight logger with optional Sentry support
// If VITE_SENTRY_DSN is provided and @sentry/react is installed, it will initialize Sentry.

let isInitialized = false;

async function tryInitSentry() {
  if (isInitialized) return;
  const dsn = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  try {
    // Dynamic import so app works even if @sentry/react is not installed
    const pkg = '@sentry/react';
    // Use variable + vite-ignore to avoid build-time resolution when not installed
    const Sentry: any = await import(/* @vite-ignore */ (pkg as string));
    Sentry.init({ dsn, tracesSampleRate: 1.0 });
    isInitialized = true;
  } catch (e) {
    // @sentry/react not installed or failed to init; proceed without it
    // console.debug('Sentry not initialized:', e);
  }
}

export async function captureException(error: unknown, context?: Record<string, any>) {
  await tryInitSentry();
  try {
    const pkg = '@sentry/react';
    const Sentry: any = await import(/* @vite-ignore */ (pkg as string)).catch(() => null);
    if (Sentry?.captureException) {
      Sentry.captureException(error, { extra: context });
      return;
    }
  } catch {}
  // Fallback to console
  console.error('[error]', error, context || {});
}

export async function captureMessage(message: string, context?: Record<string, any>) {
  await tryInitSentry();
  try {
    const pkg = '@sentry/react';
    const Sentry: any = await import(/* @vite-ignore */ (pkg as string)).catch(() => null);
    if (Sentry?.captureMessage) {
      Sentry.captureMessage(message, { level: 'info', extra: context });
      return;
    }
  } catch {}
  console.log('[info]', message, context || {});
}

export async function initLogging() {
  await tryInitSentry();
}
