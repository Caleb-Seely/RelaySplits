# App Icon Setup Documentation

## Overview
This document explains the app icon setup for RelaySplits PWA, ensuring proper display across all devices and platforms.

## Icon Organization

### Public Folder Icons (Active)
The following icons are actively used by the PWA and are located in the `public/` folder:

#### Standard Icons
- `favicon.ico` - Traditional favicon (16x16, 32x32)
- `icon-16.png` - 16x16 icon
- `icon-32.png` - 32x32 icon
- `icon-48.png` - 48x48 icon
- `icon-72.png` - 72x72 icon
- `icon-96.png` - 96x96 icon
- `icon-144.png` - 144x144 icon
- `icon-192.png` - 192x192 icon (maskable)
- `icon-512.png` - 512x512 icon (maskable)

#### Apple Touch Icons
- `apple-touch-icon.png` - 180x180 (default Apple touch icon)
- `apple-touch-icon-152.png` - 152x152 (iPad)
- `apple-touch-icon-167.png` - 167x167 (iPad Pro)

### AppImages Folder (Archive)
The `public/AppImages/` folder contains the complete icon set organized by platform:

#### Android Icons
- `android/android-launchericon-48-48.png`
- `android/android-launchericon-72-72.png`
- `android/android-launchericon-96-96.png`
- `android/android-launchericon-144-144.png`
- `android/android-launchericon-192-192.png`
- `android/android-launchericon-512-512.png`

#### iOS Icons
- `ios/16.png` through `ios/1024.png` (various sizes)
- Includes sizes: 16, 20, 29, 32, 40, 50, 57, 58, 60, 64, 72, 76, 80, 87, 100, 114, 120, 128, 144, 152, 167, 180, 192, 256, 512, 1024

#### Windows 11 Icons
- `windows11/` - Complete Windows 11 icon set with various scales and formats
- Includes SmallTile, Square150x150Logo, Wide310x150Logo, LargeTile, Square44x44Logo, StoreLogo, and SplashScreen variants

## Manifest Configuration

The `manifest.json` file includes comprehensive icon definitions:

```json
{
  "icons": [
    {
      "src": "/favicon.ico",
      "sizes": "16x16 32x32",
      "type": "image/x-icon"
    },
    {
      "src": "/icon-48.png",
      "sizes": "48x48",
      "type": "image/png"
    },
    // ... additional icons
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

## HTML Meta Tags

The `index.html` file includes comprehensive meta tags for all platforms:

### Favicon Tags
```html
<link rel="icon" href="/favicon.ico" type="image/x-icon" />
<link rel="icon" href="/icon-16.png" type="image/png" sizes="16x16" />
<link rel="icon" href="/icon-32.png" type="image/png" sizes="32x32" />
```

### Apple Touch Icons
```html
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152.png" />
<link rel="apple-touch-icon" sizes="167x167" href="/apple-touch-icon-167.png" />
```

### Android Icons
```html
<link rel="icon" type="image/png" sizes="48x48" href="/icon-48.png" />
<link rel="icon" type="image/png" sizes="72x72" href="/icon-72.png" />
<!-- ... additional sizes -->
<link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
```

### Platform-Specific Meta Tags
```html
<!-- iOS -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="RelaySplits" />

<!-- Android -->
<meta name="mobile-web-app-capable" content="yes" />
<meta name="application-name" content="RelaySplits" />
```

## Platform Support

### Android
- Uses standard PNG icons (48x48 to 512x512)
- Maskable icons for adaptive icons
- Proper manifest configuration

### iOS
- Apple touch icons for home screen
- Various sizes for different devices
- Proper meta tags for web app capability

### Windows
- Complete Windows 11 icon set available
- Various scales and formats
- Can be used for Windows app packaging

### Web Browsers
- Standard favicon support
- Progressive Web App icon support
- Maskable icons for modern browsers

## Maintenance

### Adding New Icons
1. Place new icons in the appropriate platform folder in `public/AppImages/`
2. Copy the most commonly used sizes to the `public/` folder
3. Update `manifest.json` if new sizes are needed
4. Update `index.html` meta tags if necessary

### Icon Generation
The original icon set was generated with comprehensive platform support. When updating icons:
1. Generate all platform variants
2. Maintain the same naming convention
3. Test on all target platforms

## Testing

To verify icon setup:
1. Test PWA installation on Android devices
2. Test "Add to Home Screen" on iOS devices
3. Verify favicon display in web browsers
4. Check Windows app icon if packaging for Windows

## Notes

- The `AppImages/` folder serves as an archive of all available icons
- Only the most commonly used icons are actively served from the `public/` folder
- Maskable icons (192x192 and 512x512) support adaptive icon shapes on Android
- Apple touch icons provide proper home screen appearance on iOS devices
