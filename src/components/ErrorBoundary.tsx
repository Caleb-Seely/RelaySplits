import React from "react";
import { captureException } from "@/utils/logger";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home, Wifi, WifiOff } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  retryCount: number;
  isRetrying: boolean;
}

interface ErrorBoundaryProps extends React.PropsWithChildren {
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  maxRetries?: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeout?: NodeJS.Timeout;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      retryCount: 0,
      isRetrying: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to logger (will forward to Sentry if configured)
    captureException(error, { 
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
      errorType: this.getErrorType(error)
    });
    
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
    
    this.setState({ errorInfo });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private getErrorType(error: Error): string {
    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
      return 'network';
    }
    if (error.name === 'TypeError' || error.message.includes('undefined')) {
      return 'type';
    }
    if (error.name === 'RangeError' || error.message.includes('out of range')) {
      return 'range';
    }
    return 'unknown';
  }

  private getErrorMessage(error: Error): { title: string; description: string; icon: React.ReactNode } {
    const errorType = this.getErrorType(error);
    
    switch (errorType) {
      case 'network':
        return {
          title: "Connection Problem",
          description: "We're having trouble connecting to our servers. Please check your internet connection and try again.",
          icon: <WifiOff className="h-8 w-8 text-orange-500" />
        };
      case 'type':
        return {
          title: "Data Error",
          description: "There was a problem with the data. This might be due to a recent update. Try refreshing the page.",
          icon: <AlertTriangle className="h-8 w-8 text-red-500" />
        };
      case 'range':
        return {
          title: "Invalid Operation",
          description: "Something went wrong with that action. Please try again or contact support if the problem persists.",
          icon: <AlertTriangle className="h-8 w-8 text-red-500" />
        };
      default:
        return {
          title: "Something went wrong",
          description: "An unexpected error occurred. We've been notified and are working to fix it.",
          icon: <AlertTriangle className="h-8 w-8 text-red-500" />
        };
    }
  }

  private handleRetry = () => {
    const maxRetries = this.props.maxRetries || 3;
    
    if (this.state.retryCount >= maxRetries) {
      // Max retries reached, force reload
      window.location.reload();
      return;
    }

    this.setState(prevState => ({ 
      isRetrying: true,
      retryCount: prevState.retryCount + 1 
    }));

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, this.state.retryCount) * 1000;
    
    this.retryTimeout = setTimeout(() => {
      this.setState({ 
        hasError: false, 
        error: undefined, 
        errorInfo: undefined,
        isRetrying: false 
      });
    }, delay);
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { title, description, icon } = this.getErrorMessage(this.state.error);
      const maxRetries = this.props.maxRetries || 3;
      const canRetry = this.state.retryCount < maxRetries;

      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} retry={this.handleRetry} />;
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
          <div className="max-w-md w-full space-y-6">
            {/* Error Icon */}
            <div className="flex justify-center">
              {icon}
            </div>

            {/* Error Title */}
            <h1 className="text-2xl font-semibold text-foreground">
              {title}
            </h1>

            {/* Error Description */}
            <p className="text-muted-foreground text-sm leading-relaxed">
              {description}
            </p>

            {/* Retry Count Info */}
            {canRetry && (
              <p className="text-xs text-muted-foreground">
                Attempt {this.state.retryCount + 1} of {maxRetries}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {canRetry && (
                <Button 
                  onClick={this.handleRetry}
                  disabled={this.state.isRetrying}
                  className="flex items-center gap-2"
                >
                  {this.state.isRetrying ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {this.state.isRetrying ? 'Retrying...' : 'Try Again'}
                </Button>
              )}
              
              <Button 
                variant="outline" 
                onClick={this.handleGoHome}
                className="flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go Home
              </Button>
              
              <Button 
                variant="outline" 
                onClick={this.handleReload}
              >
                Reload Page
              </Button>
            </div>

            {/* Technical Details (Development Only) */}
            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs text-muted-foreground bg-muted p-3 rounded overflow-auto max-h-32">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
