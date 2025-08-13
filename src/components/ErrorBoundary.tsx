import React from "react";
import { captureException } from "@/utils/logger";

type ErrorBoundaryState = { hasError: boolean; error?: Error };

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to logger (will forward to Sentry if configured)
    captureException(error, { componentStack: errorInfo.componentStack });
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
  }

  handleReset = () => {
    // Try a soft reset first
    this.setState({ hasError: false, error: undefined });
    // If the error persists due to corrupted state, consider a full reload
    // window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-4">
            An unexpected error occurred. You can try again or reload the page.
          </p>
          <div className="flex gap-3">
            <button className="btn btn-primary" onClick={this.handleReset}>Try again</button>
            <button className="btn" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
