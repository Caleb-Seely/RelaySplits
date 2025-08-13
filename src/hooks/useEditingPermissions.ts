
import { useAuth } from '@/contexts/AuthContext';

export const useEditingPermissions = () => {
  const { user, isWithinFreeHours } = useAuth();
  
  const canEdit = user && isWithinFreeHours;
  const isReadOnly = !canEdit;
  
  return {
    canEdit,
    isReadOnly,
    user,
    requiresAuth: !user,
    requiresSubscription: user && !isWithinFreeHours
  };
};
