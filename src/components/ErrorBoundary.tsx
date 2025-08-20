import React from 'react';

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
    // Send to monitoring service
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
