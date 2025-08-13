
import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useSecureSync = () => {
  const { user } = useAuth();

  const handleDatabaseError = useCallback((error: any, operation: string) => {
    console.error(`Database ${operation} error:`, error);
    
    // Handle specific security-related errors
    if (error?.code === 'PGRST301' || error?.message?.includes('row-level security')) {
      toast.error('Access denied. You may not have permission to perform this action.');
      return;
    }
    
    if (error?.code === 'PGRST116') {
      // No rows returned - might be normal in some cases
      console.log(`No data found for ${operation}`);
      return;
    }
    
    if (error?.code === '42501') {
      toast.error('Insufficient permissions. Please check your account status.');
      return;
    }
    
    // Generic error handling
    toast.error(`Failed to ${operation}. Please try again.`);
  }, []);

  const secureQuery = useCallback(async (
    queryBuilder: any,
    operation: string = 'fetch data'
  ) => {
    if (!user) {
      toast.error('You must be signed in to access this data.');
      return { data: null, error: 'Not authenticated' };
    }

    try {
      const result = await queryBuilder;
      
      if (result.error) {
        handleDatabaseError(result.error, operation);
        return { data: null, error: result.error };
      }
      
      return result;
    } catch (error) {
      handleDatabaseError(error, operation);
      return { data: null, error };
    }
  }, [user, handleDatabaseError]);

  const secureUpdate = useCallback(async (
    updateBuilder: any,
    operation: string = 'update data'
  ) => {
    if (!user) {
      toast.error('You must be signed in to make changes.');
      return { data: null, error: 'Not authenticated' };
    }

    try {
      const result = await updateBuilder;
      
      if (result.error) {
        handleDatabaseError(result.error, operation);
        return { data: null, error: result.error };
      }
      
      console.log(`${operation} completed successfully`);
      return result;
    } catch (error) {
      handleDatabaseError(error, operation);
      return { data: null, error };
    }
  }, [user, handleDatabaseError]);

  return {
    secureQuery,
    secureUpdate,
    handleDatabaseError
  };
};
