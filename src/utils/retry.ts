// Retry utility with exponential backoff, circuit breaker, and timeout handling

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  timeout: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000, // 1 minute
    private successThreshold: number = 2
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN' || 
        (this.state === 'CLOSED' && this.failures >= this.failureThreshold)) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
  }
}

export class RetryManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(private defaultConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    timeout: 10000,
    backoffMultiplier: 2,
    jitter: true
  }) {}

  async retry<T>(
    fn: () => Promise<T>,
    config?: Partial<RetryConfig>,
    circuitBreakerKey?: string
  ): Promise<RetryResult<T>> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const startTime = Date.now();
    let lastError: Error;

    // Use circuit breaker if key provided
    if (circuitBreakerKey) {
      const circuitBreaker = this.getCircuitBreaker(circuitBreakerKey);
      try {
        const result = await circuitBreaker.execute(fn);
        return {
          success: true,
          data: result,
          attempts: 1,
          totalTime: Date.now() - startTime
        };
      } catch (error) {
        return {
          success: false,
          error: error as Error,
          attempts: 1,
          totalTime: Date.now() - startTime
        };
      }
    }

    // Standard retry logic
    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Operation timed out')), finalConfig.timeout);
        });

        const result = await Promise.race([fn(), timeoutPromise]);
        
        return {
          success: true,
          data: result,
          attempts: attempt,
          totalTime: Date.now() - startTime
        };
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === finalConfig.maxAttempts) {
          break;
        }

        const delay = this.calculateDelay(attempt, finalConfig);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError!,
      attempts: finalConfig.maxAttempts,
      totalTime: Date.now() - startTime
    };
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    if (config.jitter) {
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay;
      delay += jitter;
    }
    
    return Math.min(delay, config.maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getCircuitBreaker(key: string): CircuitBreaker {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker());
    }
    return this.circuitBreakers.get(key)!;
  }

  resetCircuitBreaker(key: string): void {
    this.circuitBreakers.get(key)?.reset();
  }

  getCircuitBreakerState(key: string): string | undefined {
    return this.circuitBreakers.get(key)?.getState();
  }
}

// Network-specific retry utilities
export class NetworkRetryManager extends RetryManager {
  constructor() {
    super({
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      timeout: 15000,
      backoffMultiplier: 2,
      jitter: true
    });
  }

  async retryNetworkRequest<T>(
    requestFn: () => Promise<T>,
    operation: string
  ): Promise<RetryResult<T>> {
    return this.retry(
      requestFn,
      undefined,
      `network_${operation}`
    );
  }

  async retryWithExponentialBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          throw lastError;
        }
        
        // Exponential backoff: 1s, 2s, 4s, etc.
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
}

// Global retry manager instance
export const retryManager = new NetworkRetryManager();

// Utility functions for common retry patterns
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> => {
  return retryManager.retryWithExponentialBackoff(fn, maxAttempts);
};

export const retryNetworkCall = async <T>(
  fn: () => Promise<T>,
  operation: string
): Promise<RetryResult<T>> => {
  return retryManager.retryNetworkRequest(fn, operation);
};

// Timeout utility
export const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    })
  ]);
};
