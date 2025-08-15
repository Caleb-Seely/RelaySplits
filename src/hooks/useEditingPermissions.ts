
import { useAuth } from '@/contexts/AuthContext';

export const useEditingPermissions = () => {
  const { user } = useAuth();
  
  const canEdit = !!user;
  const isReadOnly = !canEdit;
  
  return {
    canEdit,
    isReadOnly,
    user,
    requiresAuth: !user
  };
};
