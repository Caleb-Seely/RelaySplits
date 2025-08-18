# PWA Installation Guide

RelaySplits is a Progressive Web App (PWA) that can be installed on your device for a native app-like experience.

## How It Works

### Automatic Detection
- The app automatically detects when it can be installed as a PWA
- This happens when:
  - You're using a supported browser (Chrome, Edge, Safari, Firefox)
  - You've visited the site at least twice
  - The app meets PWA criteria (service worker, manifest, etc.)

### Installation Prompts

#### 1. Floating Install Prompt
- A card appears at the bottom of the screen when installation is available
- Shows benefits: offline support, faster loading, app-like experience
- Can be dismissed and won't show again in the same session
- Appears on both mobile and desktop

#### 2. Dashboard Install Button
- Located in the footer of the main dashboard
- Only visible when installation is available
- Provides a secondary way to install the app

### Installation Process

1. **Click Install**: Either from the floating prompt or dashboard button
2. **Browser Prompt**: Your browser will show a native installation dialog
3. **Confirm**: Click "Install" in the browser dialog
4. **Success**: The app will be installed and can be launched from your device

### Benefits of Installing

- **Offline Support**: Works without internet connection
- **Faster Loading**: Cached resources load instantly
- **App-like Experience**: Full-screen, no browser UI
- **Home Screen Access**: Launch from your device's home screen
- **Background Sync**: Data syncs when connection is restored

### Supported Platforms

- **Mobile**: iOS Safari, Android Chrome, Samsung Internet
- **Desktop**: Chrome, Edge, Firefox, Safari
- **Tablet**: All mobile browsers plus desktop browsers

### Troubleshooting

**Install button not showing?**
- Make sure you're using a supported browser
- Visit the site multiple times (browsers require engagement)
- Check that you're on HTTPS (required for PWA)

**Installation failed?**
- Try refreshing the page
- Check your browser's site settings
- Ensure you have sufficient storage space

**App not working offline?**
- The service worker may need time to cache resources
- Try visiting the site while online first
- Check browser's site settings for storage permissions

## Technical Details

The PWA implementation includes:
- Service Worker for offline caching and background sync
- Web App Manifest for app metadata and icons
- Install prompt management
- Offline data storage and sync
- Background sync for race data

For developers, see `src/utils/serviceWorker.ts` and `src/hooks/usePWA.ts` for implementation details.
