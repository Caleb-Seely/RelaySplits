import React from 'react';
import { Loader2, AlertCircle, CheckCircle, Clock, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// Skeleton loader component
interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className, 
  width, 
  height, 
  rounded = true 
}) => {
  return (
    <div
      className={cn(
        'animate-pulse bg-muted',
        rounded && 'rounded',
        className
      )}
      style={{
        width: width,
        height: height,
      }}
    />
  );
};

// Skeleton table row
export const SkeletonTableRow: React.FC<{ columns?: number }> = ({ columns = 4 }) => {
  return (
    <div className="flex gap-4 p-4 border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="flex-1 h-4" />
      ))}
    </div>
  );
};

// Skeleton card
export const SkeletonCard: React.FC = () => {
  return (
    <div className="p-6 border rounded-lg space-y-4">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
};

// Loading spinner component
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className,
  text 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Loader2 className={cn('animate-spin', sizeClasses[size])} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  );
};

// Progress indicator component
interface ProgressIndicatorProps {
  progress: number; // 0-100
  status?: string;
  className?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ 
  progress, 
  status,
  className 
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{status || 'Loading...'}</span>
        <span className="text-muted-foreground">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

// Status indicator component
interface StatusIndicatorProps {
  status: 'loading' | 'success' | 'error' | 'warning' | 'offline';
  text?: string;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ 
  status, 
  text,
  className 
}) => {
  const statusConfig = {
    loading: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50' },
    success: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
    error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
    warning: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    offline: { icon: WifiOff, color: 'text-gray-500', bg: 'bg-gray-50' },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-2 p-2 rounded', config.bg, className)}>
      <Icon className={cn('h-4 w-4', config.color)} />
      {status === 'loading' && <Icon className={cn('h-4 w-4 animate-spin', config.color)} />}
      {text && <span className="text-sm font-medium">{text}</span>}
    </div>
  );
};

// Empty state component
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon, 
  title, 
  description, 
  action,
  className 
}) => {
  return (
    <div className={cn('text-center py-12', className)}>
      {icon && <div className="mx-auto mb-4 text-muted-foreground">{icon}</div>}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground mb-4 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};

// Loading overlay component
interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  children: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  isLoading, 
  text = 'Loading...',
  children 
}) => {
  if (!isLoading) return <>{children}</>;

  return (
    <div className="relative">
      {children}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center">
          <LoadingSpinner size="lg" text={text} />
        </div>
      </div>
    </div>
  );
};

// Network status component
interface NetworkStatusProps {
  isOnline: boolean;
  isSyncing?: boolean;
  lastSyncTime?: number;
  className?: string;
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({ 
  isOnline, 
  isSyncing,
  lastSyncTime,
  className 
}) => {
  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (lastSyncTime) {
      const timeAgo = Math.floor((Date.now() - lastSyncTime) / 1000);
      if (timeAgo < 60) return 'Just synced';
      if (timeAgo < 3600) return `Synced ${Math.floor(timeAgo / 60)}m ago`;
      return `Synced ${Math.floor(timeAgo / 3600)}h ago`;
    }
    return 'Online';
  };

  const status = !isOnline ? 'offline' : isSyncing ? 'loading' : 'success';

  return (
    <StatusIndicator 
      status={status}
      text={getStatusText()}
      className={className}
    />
  );
};

// Loading button component
interface LoadingButtonProps {
  isLoading: boolean;
  loadingText?: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({ 
  isLoading, 
  loadingText = 'Loading...',
  children,
  disabled,
  className,
  onClick
}) => {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors',
        'bg-primary text-primary-foreground hover:bg-primary/90',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      disabled={isLoading || disabled}
      onClick={onClick}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {isLoading ? loadingText : children}
    </button>
  );
};

// Page loading component
export const PageLoading: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" text="Loading page..." />
        <div className="space-y-2">
          <Skeleton className="h-4 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    </div>
  );
};

// Data loading component
export const DataLoading: React.FC<{ message?: string }> = ({ 
  message = 'Loading data...' 
}) => {
  return (
    <div className="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" text={message} />
    </div>
  );
};

// Error state component
interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ 
  title = 'Something went wrong',
  message = 'An error occurred while loading the data.',
  onRetry,
  className 
}) => {
  return (
    <EmptyState
      icon={<AlertCircle className="h-12 w-12 text-red-500" />}
      title={title}
      description={message}
      action={onRetry && (
        <LoadingButton onClick={onRetry}>
          Try Again
        </LoadingButton>
      )}
      className={className}
    />
  );
};
