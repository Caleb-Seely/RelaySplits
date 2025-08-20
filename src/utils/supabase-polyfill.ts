// Specific polyfill for Supabase to fix util.inherits issue
import util from 'util';

if (typeof window !== 'undefined') {
  // Make util available globally
  (window as any).util = util;
  
  // Ensure util.inherits is available
  if (!(window as any).util.inherits) {
    (window as any).util.inherits = util.inherits;
  }
}

export {};
