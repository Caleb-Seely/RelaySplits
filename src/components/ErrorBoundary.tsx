import React from 'react';

import { analytics } from '@/services/analytics';
import { captureSentryError } from '@/services/sentry';

export class LeaderboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Leaderboard error:', error, errorInfo);
    this.reportError(error, errorInfo);
  }
  
  private reportError(error: Error, errorInfo: React.ErrorInfo) {
    // Track error in analytics
    analytics.trackError({
      error_message: error.message,
      error_stack: error.stack,
      error_type: error.constructor.name,
      fatal: false,
      context: {
        component: 'LeaderboardErrorBoundary',
        errorInfo: errorInfo.componentStack
      }
    });

    // Capture error in Sentry
    captureSentryError(error, {
      component: 'LeaderboardErrorBoundary',
      errorInfo: errorInfo.componentStack
    }, {
      error_boundary: 'true',
      component: 'leaderboard'
    });

    // Legacy gtag tracking (keeping for backward compatibility)
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.message,
        fatal: false
      });
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="text-red-800 font-medium">Something went wrong</h3>
          <p className="text-red-600 text-sm mt-1">
            The leaderboard encountered an error. Please refresh the page.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm"
          >
            Refresh Page
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

export default LeaderboardErrorBoundary;
