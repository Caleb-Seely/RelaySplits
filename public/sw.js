const CACHE_NAME = 'relay-splits-v1';
const STATIC_CACHE = 'relay-splits-static-v1';
const API_CACHE = 'relay-splits-api-v1';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/static/js/main.js',
  '/static/css/main.css',
  '/favicon.ico',
  '/manifest.json'
];

// Background sync interval (check every 30 seconds when app is closed)
const BACKGROUND_SYNC_INTERVAL = 30000;

// Enhanced notification deduplication
const NOTIFICATION_DEDUP_KEY = 'relay_sw_notification_dedup';
const NOTIFICATION_DEDUP_WINDOW = 5 * 60 * 1000; // 5 minutes

// Global variable to store team ID received from main thread
let currentTeamId = null;
let supabaseUrl = null;
let supabaseAnonKey = null;

// Helper function to track check count for reduced logging
async function getCheckCount() {
  try {
    const count = parseInt(localStorage.getItem('sw_check_count') || '0');
    const newCount = count + 1;
    localStorage.setItem('sw_check_count', newCount.toString());
    return newCount;
  } catch (error) {
    return 1; // Fallback if localStorage fails
  }
}

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] Static files cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static files:', error);
      })
  );
});

// Activate event - clean up old caches and start background sync
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
      .then(() => {
        // Start background sync for notifications
        startBackgroundSync();
      })
  );
});

// Enhanced deduplication system for service worker notifications
function isDuplicateNotification(notificationData) {
  try {
    const dedupKey = createNotificationDedupKey(notificationData);
    const now = Date.now();
    const dedupData = JSON.parse(localStorage.getItem(NOTIFICATION_DEDUP_KEY) || '{}');
    
    // Clean up old entries
    Object.keys(dedupData).forEach(key => {
      if (now - dedupData[key] > NOTIFICATION_DEDUP_WINDOW) {
        delete dedupData[key];
      }
    });
    
    // Check if this notification was recently sent
    if (dedupData[dedupKey] && (now - dedupData[dedupKey]) < NOTIFICATION_DEDUP_WINDOW) {
      console.log(`[SW] Duplicate notification detected: ${dedupKey}`);
      return true;
    }
    
    // Store this notification
    dedupData[dedupKey] = now;
    localStorage.setItem(NOTIFICATION_DEDUP_KEY, JSON.stringify(dedupData));
    
    return false;
  } catch (error) {
    console.error('[SW] Error in deduplication check:', error);
    return false;
  }
}

function createNotificationDedupKey(notificationData) {
  const data = notificationData.data;
  if (data?.type && data?.legNumber && data?.runnerName) {
    return `sw-${data.type}-${data.legNumber}-${data.runnerName}`;
  }
  
  // For other notifications, use a hash of the title and body
  const content = `${notificationData.title}-${notificationData.body}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `sw-${Math.abs(hash)}`;
}

// Start background sync for notifications
function startBackgroundSync() {
  // Check if we should run background sync
  if ('periodicSync' in self.registration) {
    console.log('[SW] Registering periodic background sync');
    self.registration.periodicSync.register('race-updates', {
      minInterval: BACKGROUND_SYNC_INTERVAL
    }).catch(error => {
      console.log('[SW] Periodic sync not supported, using fallback:', error);
      // Fallback: use setTimeout for periodic checks
      setTimeout(checkForRaceUpdates, BACKGROUND_SYNC_INTERVAL);
    });
  } else {
    console.log('[SW] Periodic sync not supported, using fallback');
    // Fallback: use setTimeout for periodic checks
    setTimeout(checkForRaceUpdates, BACKGROUND_SYNC_INTERVAL);
  }
}

// Periodic sync event handler
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'race-updates') {
    console.log('[SW] Periodic sync triggered for race updates');
    event.waitUntil(checkForRaceUpdates());
  }
});

// Enhanced race update checking with better error handling
async function checkForRaceUpdates() {
  try {
    // Only log every 10th check to reduce noise
    const checkCount = await getCheckCount();
    const shouldLog = checkCount % 10 === 0;
    
    if (shouldLog) {
      console.log('[SW] Checking for race updates... (check #' + checkCount + ')');
    }
    
    // Get the team ID from storage
    const teamId = await getTeamIdFromStorage();
    if (!teamId) {
      if (shouldLog) {
        console.log('[SW] No team ID found, skipping race update check');
      }
      return;
    }

    // Check if notifications are enabled
    const notificationsEnabled = await getNotificationPreference();
    if (!notificationsEnabled) {
      if (shouldLog) {
        console.log('[SW] Notifications disabled, skipping race update check');
      }
      return;
    }

    // Get the last known state
    const lastKnownState = await getLastKnownState();
    
    // Fetch current race data with retry logic
    const currentState = await fetchRaceDataWithRetry(teamId);
    if (!currentState) {
      if (shouldLog) {
        console.log('[SW] Failed to fetch current race data after retries');
      }
      return;
    }

    // Compare states and send notifications for changes
    const notifications = compareStatesAndGenerateNotifications(lastKnownState, currentState);
    
    // Send notifications with deduplication
    for (const notification of notifications) {
      if (!isDuplicateNotification(notification)) {
        await showNotification(notification);
        console.log(`[SW] Sent notification: ${notification.title}`);
      } else {
        console.log(`[SW] Skipped duplicate notification: ${notification.title}`);
      }
    }

    // Update the last known state
    await saveLastKnownState(currentState);
    
    if (shouldLog) {
      console.log('[SW] Race update check completed, sent', notifications.length, 'notifications');
    }
    
    // Schedule next check
    setTimeout(checkForRaceUpdates, BACKGROUND_SYNC_INTERVAL);
  } catch (error) {
    console.error('[SW] Error checking for race updates:', error);
    // Schedule next check even if there was an error
    setTimeout(checkForRaceUpdates, BACKGROUND_SYNC_INTERVAL);
  }
}

// Enhanced fetch with retry logic
async function fetchRaceDataWithRetry(teamId, maxRetries = 3) {
  // Check if we have the Supabase URL
  if (!supabaseUrl) {
    console.log('[SW] No Supabase URL available, skipping race data fetch');
    return null;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Only log retry attempts if they're not the first attempt
      if (attempt > 1) {
        console.log(`[SW] Fetching race data, attempt ${attempt}/${maxRetries}`);
      }
      
      // Use POST with proper authentication headers
      const legsResponse = await fetch(`${supabaseUrl}/functions/v1/legs-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({ teamId })
      });
      
      if (!legsResponse.ok) {
        throw new Error(`HTTP ${legsResponse.status}`);
      }
      
      const legsData = await legsResponse.json();
      
      const runnersResponse = await fetch(`${supabaseUrl}/functions/v1/runners-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({ teamId })
      });
      
      if (!runnersResponse.ok) {
        throw new Error(`HTTP ${runnersResponse.status}`);
      }
      
      const runnersData = await runnersResponse.json();
      
      return {
        legs: legsData.legs || [],
        runners: runnersData.runners || [],
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`[SW] Fetch attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        console.error('[SW] All fetch attempts failed');
        return null;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Get team ID from storage
async function getTeamIdFromStorage() {
  try {
    // Service workers don't have direct access to localStorage
    // We'll need to get this from the main thread or use a different approach
    return currentTeamId; // Return the team ID received from main thread
  } catch (error) {
    console.log('[SW] Error getting team ID from storage:', error);
    return null;
  }
}

// Get notification preference
async function getNotificationPreference() {
  try {
    // Service workers don't have direct access to localStorage
    // Default to enabled for now
    return true;
  } catch (error) {
    console.log('[SW] Error getting notification preference:', error);
    return true; // Default to enabled
  }
}

// Get last known state from storage
async function getLastKnownState() {
  try {
    // Service workers don't have direct access to localStorage
    return null;
  } catch (error) {
    console.log('[SW] Error getting last known state:', error);
    return null;
  }
}

// Save last known state to storage
async function saveLastKnownState(state) {
  try {
    // Service workers don't have direct access to localStorage
    // This function is disabled for now
  } catch (error) {
    console.log('[SW] Error saving last known state:', error);
  }
}

// Enhanced state comparison with better change detection
function compareStatesAndGenerateNotifications(lastState, currentState) {
  const notifications = [];
  
  if (!lastState || !lastState.legs) {
    console.log('[SW] No previous state to compare against');
    return notifications;
  }

  // Check for leg start events (only for first leg)
  const lastLeg1 = lastState.legs.find(leg => leg.number === 1);
  const currentLeg1 = currentState.legs.find(leg => leg.number === 1);
  
  if (currentLeg1 && currentLeg1.actual_start && (!lastLeg1 || !lastLeg1.actual_start)) {
    const runner = currentState.runners.find(r => r.id === currentLeg1.runner_id);
    if (runner) {
      notifications.push({
        title: "And they're off! 🏃‍♂️",
        body: `${runner.name} is leaving Timberline!`,
        data: { type: 'first_leg_start', legNumber: 1, runnerName: runner.name }
      });
    }
  }

  // Check for leg finish events with enhanced logic
  currentState.legs.forEach(currentLeg => {
    const lastLeg = lastState.legs.find(leg => leg.number === currentLeg.number);
    
    if (currentLeg.actual_finish && (!lastLeg || !lastLeg.actual_finish)) {
      const runner = currentState.runners.find(r => r.id === currentLeg.runner_id);
      if (runner) {
        // Check if this is the final leg
        if (currentLeg.number === 36) {
          notifications.push({
            title: "Race Complete! 🎉",
            body: `${runner.name} finished Leg ${currentLeg.number}. Amazing job, team!`,
            data: { type: 'finish', legNumber: currentLeg.number, runnerName: runner.name }
          });
        } else {
          // Find next runner for handoff notification
          const nextLeg = currentState.legs.find(leg => leg.number === currentLeg.number + 1);
          const nextRunner = nextLeg ? currentState.runners.find(r => r.id === nextLeg.runner_id) : null;
          
          if (nextRunner) {
            // Check if this is the handoff to the final leg (leg 36)
            if (nextLeg.number === 36) {
              notifications.push({
                title: "Last leg! 🏃‍♂️",
                body: `${runner.name} hands off to ${nextRunner.name} and they are headed to the sand!`,
                data: { 
                  type: 'handoff', 
                  finishedLegNumber: currentLeg.number, 
                  finishedRunnerName: runner.name, 
                  nextLegNumber: nextLeg.number, 
                  nextRunnerName: nextRunner.name 
                }
              });
            } else {
              notifications.push({
                title: "Handoff Complete! 🤝",
                body: `${runner.name} hands off to ${nextRunner.name} running Leg ${nextLeg.number}!`,
                data: { 
                  type: 'handoff', 
                  finishedLegNumber: currentLeg.number, 
                  finishedRunnerName: runner.name, 
                  nextLegNumber: nextLeg.number, 
                  nextRunnerName: nextRunner.name 
                }
              });
            }
          }
        }
      }
    }
  });

  return notifications;
}

// Get the best notification icon based on platform
function getBestNotificationIcon() {
  // For service worker, we'll use a conservative approach
  // since we don't have access to navigator.userAgent
  return '/icon-192.png'; // Default to 192x192 which works well on most platforms
}

// Get the best notification badge based on platform
function getBestNotificationBadge() {
  return '/icon-96.png'; // Default to 96x96 for badges
}

// Enhanced notification showing with better error handling
async function showNotification(notification) {
  try {
    const icon = getBestNotificationIcon();
    const badge = getBestNotificationBadge();
    
    const options = {
      body: notification.body,
      icon: icon,
      badge: badge,
      data: notification.data,
      requireInteraction: false,
      silent: false,
      tag: `sw-${notification.data.type}-${notification.data.legNumber || notification.data.finishedLegNumber}-${notification.data.runnerName || notification.data.finishedRunnerName}`
    };
    
    await self.registration.showNotification(notification.title, options);
    console.log('[SW] Background notification sent:', notification.title);
  } catch (error) {
    console.error('[SW] Error showing notification:', error);
    
    // Try minimal notification as fallback
    try {
      await self.registration.showNotification(notification.title, {
        body: notification.body,
        tag: options.tag
      });
      console.log('[SW] Minimal fallback notification sent');
    } catch (fallbackError) {
      console.error('[SW] Fallback notification also failed:', fallbackError);
    }
  }
}

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/functions/v1/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static files
  if (url.origin === self.location.origin) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Handle external requests (Google Maps, etc.)
  if (url.hostname === 'maps.googleapis.com' || url.hostname === 'maps.gstatic.com') {
    event.respondWith(handleExternalRequest(request));
    return;
  }
});

// Handle API requests with cache-first strategy
async function handleApiRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(API_CACHE);
      const clonedResponse = networkResponse.clone();
      cache.put(request, clonedResponse);
      return networkResponse;
    }
    
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving API response from cache');
      return cachedResponse;
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for API request');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API requests
    return new Response(
      JSON.stringify({ error: 'Offline - No cached data available' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static files with cache-first strategy
async function handleStaticRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      const clonedResponse = networkResponse.clone();
      cache.put(request, clonedResponse);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed for static file:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

// Handle external requests with network-first strategy
async function handleExternalRequest(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.log('[SW] External request failed:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

// Background sync for offline changes
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(syncOfflineData());
  }
});

// Sync offline data when connection is restored
async function syncOfflineData() {
  try {
    // This would trigger the offline queue processing
    // The actual sync logic is handled in useOfflineQueue.ts
    console.log('[SW] Background sync completed');
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Handle push notifications (future feature)
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received:', event);
  
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('[SW] Push data:', data);
      
      const icon = getBestNotificationIcon();
      const badge = getBestNotificationBadge();
      
      const options = {
        body: data.body,
        icon: icon,
        badge: badge,
        data: data.data,
        requireInteraction: false,
        silent: false
      };
      
      event.waitUntil(
        self.registration.showNotification(data.title, options)
          .then(() => {
            console.log('[SW] Push notification shown successfully');
          })
          .catch((error) => {
            console.error('[SW] Failed to show push notification:', error);
          })
      );
    } catch (error) {
      console.error('[SW] Error parsing push data:', error);
    }
  } else {
    console.log('[SW] Push event received but no data');
  }
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, data } = event.data;
    
    const icon = getBestNotificationIcon();
    const badge = getBestNotificationBadge();
    
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: icon,
        badge: badge,
        data,
        requireInteraction: false,
        silent: false
      })
    );
  }
  
  // Handle team ID updates from main thread
  if (event.data && event.data.type === 'UPDATE_TEAM_ID') {
    currentTeamId = event.data.teamId;
    console.log('[SW] Team ID updated:', currentTeamId);
  }

  // Handle Supabase config updates from main thread
  if (event.data && event.data.type === 'UPDATE_SUPABASE_CONFIG') {
    supabaseUrl = event.data.supabaseUrl;
    supabaseAnonKey = event.data.supabaseAnonKey;
    console.log('[SW] Supabase config updated:', { supabaseUrl, hasAnonKey: !!supabaseAnonKey });
  }
  
  // Handle start background sync message
  if (event.data && event.data.type === 'START_BACKGROUND_SYNC') {
    console.log('[SW] Starting background sync from main app');
    startBackgroundSync();
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Get notification data to potentially handle different actions
  const notificationData = event.notification.data;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If app is not open, open it
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
