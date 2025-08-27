import { captureSentryError } from '@/services/sentry';
import { analytics } from '@/services/analytics';
import { toast } from 'sonner';

export interface ErrorContext {
  component?: string;
  operation?: string;
  userId?: string;
  teamId?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorHandlerOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  reportToSentry?: boolean;
  reportToAnalytics?: boolean;
  retryable?: boolean;
  maxRetries?: number;
}

export class AppError extends Error {
  public readonly context: ErrorContext;
  public readonly retryable: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    context: ErrorContext = {},
    retryable: boolean = false,
    code?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.context = context;
    this.retryable = retryable;
    this.code = code;
  }
}

export class NetworkError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, context, true, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, context, false, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class SyncError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, context, true, 'SYNC_ERROR');
    this.name = 'SyncError';
  }
}

export const handleError = (
  error: Error | AppError,
  options: ErrorHandlerOptions = {},
  context: ErrorContext = {}
): void => {
  const {
    showToast = true,
    logToConsole = true,
    reportToSentry = true,
    reportToAnalytics = true,
    retryable = false,
    maxRetries = 3
  } = options;

  const appError = error instanceof AppError ? error : new AppError(error.message, context, retryable);
  const fullContext = { ...context, ...appError.context };

  // Console logging
  if (logToConsole) {
    console.error(`[${fullContext.component || 'Unknown'}] Error:`, {
      message: appError.message,
      code: appError.code,
      retryable: appError.retryable,
      context: fullContext,
      stack: appError.stack
    });
  }

  // User notification
  if (showToast) {
    const isNetworkError = appError instanceof NetworkError;
    const isValidationError = appError instanceof ValidationError;
    
    if (isNetworkError) {
      toast.error('Network error. Please check your connection and try again.');
    } else if (isValidationError) {
      toast.error(appError.message);
    } else {
      toast.error('Something went wrong. Please try again.');
    }
  }

  // Error reporting
  if (reportToSentry) {
    captureSentryError(appError, fullContext, {
      error_type: appError.constructor.name,
      error_code: appError.code,
      retryable: appError.retryable.toString()
    });
  }

  // Analytics tracking
  if (reportToAnalytics) {
    analytics.trackError({
      error_message: appError.message,
      error_type: appError.constructor.name,
      error_code: appError.code,
      retryable: appError.retryable,
      context: fullContext
    });
  }
};

export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  options: ErrorHandlerOptions = {},
  context: ErrorContext = {}
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error as Error, options, context);
      throw error;
    }
  };
};

export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context: ErrorContext = {}
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        handleError(lastError, { showToast: true }, {
          ...context,
          operation: 'retryWithBackoff',
          attempt: attempt.toString()
        });
        throw lastError;
      }
      
      // Don't retry non-retryable errors
      if (error instanceof AppError && !error.retryable) {
        throw error;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

// Global error handlers
export const setupGlobalErrorHandling = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    handleError(new Error(event.reason), {
      showToast: false,
      reportToSentry: true,
      reportToAnalytics: true
    }, {
      component: 'Global',
      operation: 'unhandledrejection'
    });
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    handleError(new Error(event.message), {
      showToast: false,
      reportToSentry: true,
      reportToAnalytics: true
    }, {
      component: 'Global',
      operation: 'globalError',
      additionalData: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    });
  });
};
