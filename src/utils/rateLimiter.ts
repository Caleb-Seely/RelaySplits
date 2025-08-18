// Client-side rate limiting utility
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (request: Request) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  isAllowed(request: Request): RateLimitResult {
    const key = this.config.keyGenerator ? this.config.keyGenerator(request) : this.getDefaultKey(request);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing requests for this key
    let requests = this.requests.get(key) || [];
    
    // Filter out old requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if we're under the limit
    const allowed = requests.length < this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - requests.length);
    
    if (allowed) {
      // Add current request
      requests.push(now);
      this.requests.set(key, requests);
    }

    // Calculate reset time
    const resetTime = windowStart + this.config.windowMs;
    
    // Calculate retry after if rate limited
    const retryAfter = allowed ? undefined : Math.ceil((resetTime - now) / 1000);

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter
    };
  }

  private getDefaultKey(request: Request): string {
    // Use device ID or IP-based key
    const deviceId = localStorage.getItem('relay_device_id') || 'unknown';
    const url = new URL(request.url);
    return `${deviceId}:${url.pathname}`;
  }

  // Clean up old entries periodically
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, requests] of this.requests.entries()) {
      const filteredRequests = requests.filter(timestamp => timestamp > windowStart);
      if (filteredRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filteredRequests);
      }
    }
  }

  // Reset rate limit for a specific key
  reset(key: string): void {
    this.requests.delete(key);
  }

  // Get current status for a key
  getStatus(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    return {
      allowed: validRequests.length < this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - validRequests.length),
      resetTime: windowStart + this.config.windowMs
    };
  }
}

// Global rate limiter instances
export const apiRateLimiter = new RateLimiter({
  maxRequests: 100, // 100 requests per window
  windowMs: 60000,  // 1 minute window
  keyGenerator: (request: Request) => {
    const deviceId = localStorage.getItem('relay_device_id') || 'unknown';
    const url = new URL(request.url);
    return `${deviceId}:api:${url.pathname}`;
  }
});

export const syncRateLimiter = new RateLimiter({
  maxRequests: 10,  // 10 sync requests per window
  windowMs: 30000,  // 30 second window
  keyGenerator: (request: Request) => {
    const deviceId = localStorage.getItem('relay_device_id') || 'unknown';
    return `${deviceId}:sync`;
  }
});

// Rate limiting middleware for fetch requests
export function withRateLimit(
  fetchFn: typeof fetch,
  rateLimiter: RateLimiter
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const result = rateLimiter.isAllowed(request);

    if (!result.allowed) {
      // Return rate limited response
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          message: 'Too many requests. Please try again later.'
        }),
        {
          status: 429,
          statusText: 'Too Many Requests',
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': result.retryAfter?.toString() || '60',
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetTime.toString()
          }
        }
      );
    }

    // Don't add rate limit headers to outgoing requests to avoid CORS issues
    // Just pass through the original request
    return fetchFn(request, init);
  };
}

// Enhanced fetch with rate limiting
export const rateLimitedFetch = withRateLimit(fetch, apiRateLimiter);

// Utility to check if response indicates rate limiting
export function isRateLimited(response: Response): boolean {
  return response.status === 429;
}

// Utility to get retry delay from rate limited response
export function getRetryDelay(response: Response): number {
  const retryAfter = response.headers.get('Retry-After');
  return retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000; // Default 60 seconds
}

// Periodic cleanup
setInterval(() => {
  apiRateLimiter.cleanup();
  syncRateLimiter.cleanup();
}, 60000); // Clean up every minute
