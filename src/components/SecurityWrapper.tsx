
import React from 'react';
import { useEditingPermissions } from '@/hooks/useEditingPermissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface SecurityWrapperProps {
  children: React.ReactNode;
  requiresEdit?: boolean;
  fallback?: React.ReactNode;
  className?: string;
}

const SecurityWrapper: React.FC<SecurityWrapperProps> = ({ 
  children, 
  requiresEdit = false, 
  fallback,
  className 
}) => {
  const { canEdit, isReadOnly, requiresAuth } = useEditingPermissions();

  // If editing is required but user can't edit, show appropriate message
  if (requiresEdit && isReadOnly) {
    if (requiresAuth) {
      return (
        <div className={className}>
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              You must be signed in to access this feature.
              <Link to="/auth">
                <Button variant="link" className="p-0 h-auto font-semibold ml-1">
                  Sign In
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
          {fallback}
        </div>
      );
    }
  }

  return <div className={className}>{children}</div>;
};

export default SecurityWrapper;
