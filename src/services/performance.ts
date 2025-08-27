import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

import { analytics } from './analytics';
import { captureSentryError } from './sentry';

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  id?: string;
}

// Performance thresholds based on Google's Core Web Vitals
const PERFORMANCE_THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 }
};

// Get performance rating
function getRating(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = PERFORMANCE_THRESHOLDS[metric as keyof typeof PERFORMANCE_THRESHOLDS];
  if (!thresholds) return 'good';

  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

// Track performance metric
function trackPerformanceMetric(metric: PerformanceMetric) {
  try {
    // Track in analytics
    analytics.trackPerformance({
      metric_name: metric.name,
      value: metric.value,
      unit: 'ms'
    });

    // Track in Sentry if performance is poor
    if (metric.rating === 'poor') {
      captureSentryError(
        `Poor performance detected: ${metric.name} = ${metric.value}`,
        {
          metric_name: metric.name,
          metric_value: metric.value,
          metric_rating: metric.rating,
          metric_delta: metric.delta
        },
        {
          performance_issue: 'true',
          metric_type: metric.name.toLowerCase()
        }
      );
    }

    // Log in development
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${metric.name}: ${metric.value} (${metric.rating})`);
    }
  } catch (error) {
    console.error('[Performance] Failed to track metric:', error);
  }
}

// Initialize Core Web Vitals tracking
export function initPerformanceMonitoring() {
  try {
    // Cumulative Layout Shift (CLS)
    getCLS((metric) => {
      trackPerformanceMetric({
        name: 'CLS',
        value: metric.value,
        rating: getRating('CLS', metric.value),
        delta: metric.delta,
        id: metric.id
      });
    });

    // First Input Delay (FID)
    getFID((metric) => {
      trackPerformanceMetric({
        name: 'FID',
        value: metric.value,
        rating: getRating('FID', metric.value),
        delta: metric.delta,
        id: metric.id
      });
    });

    // First Contentful Paint (FCP)
    getFCP((metric) => {
      trackPerformanceMetric({
        name: 'FCP',
        value: metric.value,
        rating: getRating('FCP', metric.value),
        delta: metric.delta,
        id: metric.id
      });
    });

    // Largest Contentful Paint (LCP)
    getLCP((metric) => {
      trackPerformanceMetric({
        name: 'LCP',
        value: metric.value,
        rating: getRating('LCP', metric.value),
        delta: metric.delta,
        id: metric.id
      });
    });

    // Time to First Byte (TTFB)
    getTTFB((metric) => {
      trackPerformanceMetric({
        name: 'TTFB',
        value: metric.value,
        rating: getRating('TTFB', metric.value),
        delta: metric.delta,
        id: metric.id
      });
    });

    console.log('[Performance] Core Web Vitals monitoring initialized');
  } catch (error) {
    console.error('[Performance] Failed to initialize monitoring:', error);
  }
}

// Custom performance measurement utilities
export class PerformanceTimer {
  private startTime: number;
  private name: string;
  private context?: Record<string, any>;

  constructor(name: string, context?: Record<string, any>) {
    this.startTime = performance.now();
    this.name = name;
    this.context = context;
  }

  end(): number {
    const duration = performance.now() - this.startTime;
    
    analytics.trackPerformance({
      metric_name: this.name,
      value: duration,
      unit: 'ms'
    });

    if (import.meta.env.DEV) {
      console.log(`[Performance] ${this.name}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  endWithCallback(callback: (duration: number) => void): number {
    const duration = this.end();
    callback(duration);
    return duration;
  }
}

// Measure function execution time
export function measurePerformance<T>(
  name: string,
  fn: () => T,
  context?: Record<string, any>
): T {
  const timer = new PerformanceTimer(name, context);
  try {
    const result = fn();
    timer.end();
    return result;
  } catch (error) {
    timer.end();
    throw error;
  }
}

// Measure async function execution time
export async function measureAsyncPerformance<T>(
  name: string,
  fn: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  const timer = new PerformanceTimer(name, context);
  try {
    const result = await fn();
    timer.end();
    return result;
  } catch (error) {
    timer.end();
    throw error;
  }
}

// Track resource loading performance
export function trackResourcePerformance() {
  if (typeof window === 'undefined') return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'resource') {
        const resourceEntry = entry as PerformanceResourceTiming;
        
        analytics.trackPerformance({
          metric_name: `resource_${resourceEntry.name.split('/').pop()?.split('?')[0] || 'unknown'}`,
          value: resourceEntry.duration,
          unit: 'ms'
        });
      }
    }
  });

  try {
    observer.observe({ entryTypes: ['resource'] });
  } catch (error) {
    console.error('[Performance] Failed to observe resources:', error);
  }
}

// Track navigation performance
export function trackNavigationPerformance() {
  if (typeof window === 'undefined') return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'navigation') {
        const navEntry = entry as PerformanceNavigationTiming;
        
        // Track various navigation metrics
        const metrics = [
          { name: 'dom_content_loaded', value: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart },
          { name: 'load_complete', value: navEntry.loadEventEnd - navEntry.loadEventStart },
          { name: 'dom_interactive', value: navEntry.domInteractive - navEntry.fetchStart },
          { name: 'first_paint', value: navEntry.responseStart - navEntry.fetchStart }
        ];

        metrics.forEach(metric => {
          if (metric.value > 0) {
            analytics.trackPerformance({
              metric_name: metric.name,
              value: metric.value,
              unit: 'ms'
            });
          }
        });
      }
    }
  });

  try {
    observer.observe({ entryTypes: ['navigation'] });
  } catch (error) {
    console.error('[Performance] Failed to observe navigation:', error);
  }
}

// Get current performance metrics
export function getCurrentPerformanceMetrics(): Record<string, number> {
  if (typeof window === 'undefined') return {};

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (!navigation) return {};

  return {
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
    domInteractive: navigation.domInteractive - navigation.fetchStart,
    firstPaint: navigation.responseStart - navigation.fetchStart,
    totalLoadTime: navigation.loadEventEnd - navigation.fetchStart
  };
}

// Export convenience functions
export const startTimer = (name: string, context?: Record<string, any>) => new PerformanceTimer(name, context);
