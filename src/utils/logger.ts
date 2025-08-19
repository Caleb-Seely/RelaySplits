// Production-ready logging utility
const isDevelopment = import.meta.env.DEV;
const isVerbose = import.meta.env.DEV && import.meta.env.VITE_VERBOSE_LOGGING === 'true';

interface LogLevel {
  DEBUG: 0;
  INFO: 1;
  WARN: 2;
  ERROR: 3;
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const currentLogLevel = isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;

// Simple error logging functions
export async function captureException(error: unknown, context?: Record<string, any>) {
  console.error('[ERROR]', error, context || {});
}

export async function captureMessage(message: string, context?: Record<string, any>) {
  console.log('[INFO]', message, context || {});
}

export async function initLogging() {
  // No-op for now
}

class Logger {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  private formatMessage(level: string, message: string): string {
    return this.prefix ? `[${this.prefix}] ${level}: ${message}` : `${level}: ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (currentLogLevel <= LOG_LEVELS.DEBUG && isVerbose) {
      console.log(this.formatMessage('DEBUG', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
      console.log(this.formatMessage('INFO', message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (currentLogLevel <= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (currentLogLevel <= LOG_LEVELS.ERROR) {
      console.error(this.formatMessage('ERROR', message), ...args);
    }
  }

  // Special method for sync operations that should always be logged in development
  sync(message: string, ...args: any[]): void {
    if (isDevelopment) {
      console.log(this.formatMessage('SYNC', message), ...args);
    }
  }

  // Method for critical operations that should always be logged
  critical(message: string, ...args: any[]): void {
    console.log(this.formatMessage('CRITICAL', message), ...args);
  }
}

// Create logger instances for different components
export const createLogger = (prefix: string) => new Logger(prefix);

// Default loggers
export const syncLogger = createLogger('SyncManager');
export const eventLogger = createLogger('EventBus');
export const queueLogger = createLogger('OfflineQueue');
export const apiLogger = createLogger('API');

// Export the Logger class for custom instances
export { Logger };
