import { analytics } from '@/services/analytics';

export interface PerformanceMetric {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, any>;
}

export interface PerformanceThresholds {
  warning: number; // milliseconds
  error: number; // milliseconds
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private thresholds: Map<string, PerformanceThresholds> = new Map();
  private enabled: boolean = true;

  constructor() {
    // Set default thresholds
    this.setThreshold('api-call', { warning: 2000, error: 5000 });
    this.setThreshold('sync-operation', { warning: 3000, error: 8000 });
    this.setThreshold('component-render', { warning: 100, error: 500 });
    this.setThreshold('data-processing', { warning: 1000, error: 3000 });
  }

  setThreshold(name: string, thresholds: PerformanceThresholds): void {
    this.thresholds.set(name, thresholds);
  }

  startTimer(name: string): () => void {
    if (!this.enabled) return () => {};

    const startTime = performance.now();
    
    return () => {
      this.endTimer(name, startTime);
    };
  }

  private endTimer(name: string, startTime: number): void {
    const endTime = performance.now();
    const duration = endTime - startTime;

    const metric: PerformanceMetric = {
      name,
      duration,
      startTime,
      endTime
    };

    // Store metric
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(metric);

    // Check thresholds
    this.checkThresholds(name, duration);

    // Report to analytics
    this.reportMetric(metric);
  }

  private checkThresholds(name: string, duration: number): void {
    const threshold = this.thresholds.get(name);
    if (!threshold) return;

    if (duration >= threshold.error) {
      console.error(`[Performance] ${name} exceeded error threshold: ${duration}ms`);
      analytics.trackError({
        error_message: `Performance threshold exceeded: ${name}`,
        error_type: 'PerformanceError',
        context: { metric: name, duration, threshold: threshold.error }
      });
    } else if (duration >= threshold.warning) {
      console.warn(`[Performance] ${name} exceeded warning threshold: ${duration}ms`);
    }
  }

  private reportMetric(metric: PerformanceMetric): void {
    analytics.trackEvent('performance_metric', {
      metric_name: metric.name,
      duration: metric.duration,
      metadata: metric.metadata
    });
  }

  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const endTime = performance.now();
      
      const metric: PerformanceMetric = {
        name,
        duration: endTime - startTime,
        startTime,
        endTime,
        metadata
      };

      this.metrics.get(name)?.push(metric) || this.metrics.set(name, [metric]);
      this.checkThresholds(name, metric.duration);
      this.reportMetric(metric);
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      
      const metric: PerformanceMetric = {
        name: `${name}_error`,
        duration: endTime - startTime,
        startTime,
        endTime,
        metadata: { ...metadata, error: true }
      };

      this.metrics.get(metric.name)?.push(metric) || this.metrics.set(metric.name, [metric]);
      this.reportMetric(metric);
      
      throw error;
    }
  }

  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.get(name) || [];
    }
    
    return Array.from(this.metrics.values()).flat();
  }

  getAverageDuration(name: string): number {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return 0;
    
    const total = metrics.reduce((sum, metric) => sum + metric.duration, 0);
    return total / metrics.length;
  }

  clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience functions
export const measureAsync = <T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> => {
  return performanceMonitor.measureAsync(name, fn, metadata);
};

export const startTimer = (name: string): (() => void) => {
  return performanceMonitor.startTimer(name);
};

// React performance monitoring
export const withPerformanceTracking = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> => {
  return React.memo((props: P) => {
    const endTimer = startTimer(`component-render-${componentName}`);
    
    React.useEffect(() => {
      endTimer();
    });
    
    return <Component {...props} />;
  });
};

// Hook for measuring component performance
export const usePerformanceTracking = (componentName: string) => {
  const endTimer = startTimer(`component-render-${componentName}`);
  
  React.useEffect(() => {
    endTimer();
  });
};

// Memory usage monitoring
export const getMemoryUsage = (): Record<string, number> => {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    };
  }
  return {};
};

// Network performance monitoring
export const measureNetworkRequest = async <T>(
  name: string,
  request: () => Promise<T>
): Promise<T> => {
  return measureAsync(`network-${name}`, request);
};
