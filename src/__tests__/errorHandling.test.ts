import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { 
  handleError, 
  withErrorHandling, 
  retryWithBackoff,
  AppError,
  NetworkError,
  ValidationError,
  SyncError
} from '../utils/errorHandling';

// Mock dependencies
vi.mock('../services/sentry', () => ({
  captureSentryError: vi.fn()
}));

vi.mock('../services/analytics', () => ({
  analytics: {
    trackError: vi.fn()
  }
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn()
  }
}));

describe('Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AppError', () => {
    it('should create AppError with correct properties', () => {
      const context = { component: 'TestComponent', operation: 'test' };
      const error = new AppError('Test error', context, true, 'TEST_ERROR');

      expect(error.message).toBe('Test error');
      expect(error.context).toEqual(context);
      expect(error.retryable).toBe(true);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.name).toBe('AppError');
    });
  });

  describe('NetworkError', () => {
    it('should create NetworkError with correct properties', () => {
      const error = new NetworkError('Network failed');

      expect(error.message).toBe('Network failed');
      expect(error.retryable).toBe(true);
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.name).toBe('NetworkError');
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with correct properties', () => {
      const error = new ValidationError('Invalid data');

      expect(error.message).toBe('Invalid data');
      expect(error.retryable).toBe(false);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('handleError', () => {
    it('should handle regular Error objects', () => {
      const error = new Error('Test error');
      const context = { component: 'TestComponent' };

      handleError(error, { showToast: true }, context);

      expect(console.error).toHaveBeenCalledWith(
        '[TestComponent] Error:',
        expect.objectContaining({
          message: 'Test error',
          retryable: false
        })
      );
    });

    it('should handle AppError objects', () => {
      const error = new NetworkError('Network failed');
      const context = { component: 'TestComponent' };

      handleError(error, { showToast: true }, context);

      expect(console.error).toHaveBeenCalledWith(
        '[TestComponent] Error:',
        expect.objectContaining({
          message: 'Network failed',
          retryable: true,
          code: 'NETWORK_ERROR'
        })
      );
    });

    it('should show appropriate toast messages for different error types', () => {
      const { toast } = await import('sonner');

      // Network error
      const networkError = new NetworkError('Network failed');
      handleError(networkError, { showToast: true });
      expect(toast.error).toHaveBeenCalledWith('Network error. Please check your connection and try again.');

      // Validation error
      const validationError = new ValidationError('Invalid data');
      handleError(validationError, { showToast: true });
      expect(toast.error).toHaveBeenCalledWith('Invalid data');

      // Generic error
      const genericError = new Error('Something went wrong');
      handleError(genericError, { showToast: true });
      expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.');
    });

    it('should respect showToast option', async () => {
      const { toast } = await import('sonner');
      const error = new Error('Test error');

      handleError(error, { showToast: false });
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe('withErrorHandling', () => {
    it('should wrap async functions with error handling', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));
      const wrappedFn = withErrorHandling(mockFn, { showToast: false }, { component: 'TestComponent' });

      await expect(wrappedFn()).rejects.toThrow('Test error');
      expect(console.error).toHaveBeenCalled();
    });

    it('should pass through successful results', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const wrappedFn = withErrorHandling(mockFn, { showToast: false });

      const result = await wrappedFn();
      expect(result).toBe('success');
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('retryWithBackoff', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await retryWithBackoff(mockFn, 3, 10);
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should not retry non-retryable errors', async () => {
      const validationError = new ValidationError('Invalid data');
      const mockFn = vi.fn().mockRejectedValue(validationError);

      await expect(retryWithBackoff(mockFn, 3)).rejects.toThrow('Invalid data');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(retryWithBackoff(mockFn, 2, 10)).rejects.toThrow('Persistent failure');
      expect(mockFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should use exponential backoff', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Failure'));
      const startTime = Date.now();

      try {
        await retryWithBackoff(mockFn, 2, 100);
      } catch (error) {
        // Should have waited at least 100ms + 200ms = 300ms
        const elapsed = Date.now() - startTime;
        expect(elapsed).toBeGreaterThanOrEqual(300);
      }
    });
  });
});
