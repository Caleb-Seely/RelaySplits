// Simple PWA test script
// Run this in the browser console to test PWA functionality

console.log('🧪 Testing PWA functionality...');

// Test 1: Check if service worker is registered
if ('serviceWorker' in navigator) {
  console.log('✅ Service Worker API is supported');
  
  navigator.serviceWorker.getRegistrations().then(registrations => {
    if (registrations.length > 0) {
      console.log('✅ Service Worker is registered:', registrations[0]);
    } else {
      console.log('❌ No Service Worker found');
    }
  });
} else {
  console.log('❌ Service Worker API not supported');
}

// Test 2: Check if PWA can be installed
if ('beforeinstallprompt' in window) {
  console.log('✅ PWA installation is supported');
} else {
  console.log('❌ PWA installation not supported');
}

// Test 3: Check manifest
fetch('/manifest.json')
  .then(response => response.json())
  .then(manifest => {
    console.log('✅ Manifest loaded:', manifest.name);
    console.log('📱 Display mode:', manifest.display);
    console.log('🎯 Start URL:', manifest.start_url);
  })
  .catch(error => {
    console.log('❌ Failed to load manifest:', error);
  });

// Test 4: Check if app is already installed
if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
  console.log('✅ App is running in standalone mode (installed)');
} else {
  console.log('ℹ️ App is running in browser mode');
}

// Test 5: Check offline capability
if ('caches' in window) {
  console.log('✅ Cache API is supported');
  caches.keys().then(cacheNames => {
    console.log('📦 Available caches:', cacheNames);
  });
} else {
  console.log('❌ Cache API not supported');
}

console.log('🏁 PWA tests completed!');
