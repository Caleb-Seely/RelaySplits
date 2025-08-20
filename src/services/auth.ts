import { supabase } from '@/integrations/supabase/client';

console.log('🔧 Auth service loaded successfully');

/**
 * Simple authentication service for leaderboard access
 * Allows anonymous users to create temporary sessions for better performance
 */

export interface AuthSession {
  id: string;
  created_at: string;
  expires_at: string;
  user_agent: string;
  ip_address?: string;
}

/**
 * Create a temporary anonymous session for leaderboard access
 */
export async function createAnonymousSession(): Promise<AuthSession | null> {
  console.log('🔐 Creating anonymous session...');
  try {
    // Create a temporary anonymous user session
    const { data, error } = await supabase.auth.signUp({
      email: `anonymous-${Date.now()}@temp.relaysplits.com`,
      password: `temp-${Math.random().toString(36).substring(2)}`,
      options: {
        data: {
          anonymous: true,
          session_type: 'leaderboard_viewer'
        }
      }
    });

    if (error) {
      console.warn('Failed to create anonymous session:', error);
      return null;
    }

    if (data.session) {
      console.log('✅ Anonymous session created successfully');
      return {
        id: data.session.user.id,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        user_agent: navigator.userAgent,
      };
    }

    return null;
  } catch (error) {
    console.warn('Error creating anonymous session:', error);
    return null;
  }
}

/**
 * Check if current session is anonymous
 */
export async function isAnonymousSession(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.user_metadata?.anonymous === true;
  } catch (error) {
    return false;
  }
}

/**
 * Clean up anonymous sessions (call this when user leaves)
 */
export async function cleanupAnonymousSession(): Promise<void> {
  try {
    const isAnonymous = await isAnonymousSession();
    if (isAnonymous) {
      await supabase.auth.signOut();
    }
  } catch (error) {
    console.warn('Error cleaning up anonymous session:', error);
  }
}

/**
 * Get or create an anonymous session for leaderboard access
 */
export async function ensureLeaderboardAccess(): Promise<boolean> {
  console.log('🔐 ensureLeaderboardAccess called');
  try {
    // First check if user is already authenticated as a team member
    const storedTeamId = localStorage.getItem('relay_team_id');
    const storedDeviceInfo = localStorage.getItem('relay_device_info');
    
    if (storedTeamId && storedDeviceInfo) {
      console.log('🔐 Team member already authenticated, skipping anonymous session');
      return true;
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    console.log('🔐 Current session:', session ? 'exists' : 'none');
    
    if (session) {
      // Already have a session
      console.log('✅ Using existing session');
      return true;
    }

    // Only create anonymous session if not a team member and no existing session
    console.log('🔐 Creating new anonymous session...');
    const anonymousSession = await createAnonymousSession();
    const result = !!anonymousSession;
    console.log('🔐 Anonymous session result:', result);
    return result;
  } catch (error) {
    console.warn('Error ensuring leaderboard access:', error);
    return false;
  }
}
