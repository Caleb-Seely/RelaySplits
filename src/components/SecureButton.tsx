
import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { useEditingPermissions } from '@/hooks/useEditingPermissions';
import { Lock } from 'lucide-react';

interface SecureButtonProps extends ButtonProps {
  requiresEdit?: boolean;
  fallbackTooltip?: string;
}

const SecureButton: React.FC<SecureButtonProps> = ({ 
  children, 
  requiresEdit = true,
  fallbackTooltip = "Editing requires authentication and active subscription",
  disabled,
  ...props 
}) => {
  const { canEdit, isReadOnly } = useEditingPermissions();

  if (requiresEdit && isReadOnly) {
    return (
      <Button
        {...props}
        disabled={true}
        variant="outline"
        title={fallbackTooltip}
      >
        <Lock className="h-3 w-3 mr-1" />
        {children}
      </Button>
    );
  }

  return (
    <Button {...props} disabled={disabled}>
      {children}
    </Button>
  );
};

export default SecureButton;
