
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isWithinFreeHours: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWithinFreeHours, setIsWithinFreeHours] = useState(false);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Check free tier status when user signs in
        if (session?.user) {
          setTimeout(() => {
            checkFreeHours(session.user.id);
          }, 0);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        setTimeout(() => {
          checkFreeHours(session.user.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkFreeHours = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('signup_time, subscription_status')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error checking free hours:', error);
        return;
      }

      if (data) {
        const signupTime = new Date(data.signup_time);
        const eightHoursLater = new Date(signupTime.getTime() + 8 * 60 * 60 * 1000);
        const now = new Date();
        
        const withinFreeHours = now < eightHoursLater || data.subscription_status === 'active';
        setIsWithinFreeHours(withinFreeHours);
      }
    } catch (error) {
      console.error('Error checking free tier status:', error);
    }
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsWithinFreeHours(false);
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    isWithinFreeHours
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
