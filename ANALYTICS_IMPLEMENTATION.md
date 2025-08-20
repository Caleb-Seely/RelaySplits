# Analytics & Crash Reporting Implementation

This document outlines the comprehensive analytics and crash reporting implementation for RelaySplits.

## Overview

The analytics layer consists of three main components:

1. **Google Analytics 4 (GA4)** - User engagement and business metrics
2. **Sentry** - Crash reporting and performance monitoring
3. **Performance Monitoring** - Core Web Vitals and custom metrics

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Hooks   │    │  Analytics      │    │   Performance   │
│   (useAnalytics)│───▶│   Service       │───▶│   Monitoring    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Sentry        │
                       │   Service       │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   GA4 + Sentry  │
                       │   (External)    │
                       └─────────────────┘
```

## Setup Instructions

### 1. Environment Variables

Create a `.env` file with the following variables:

```env
# Google Analytics (already configured)
VITE_GA_MEASUREMENT_ID=G-E4PBDFCZQ5

# Sentry (you need to create a Sentry project)
VITE_SENTRY_DSN=your_sentry_dsn_here

# Feature flags
VITE_ENABLE_ANALYTICS=true
VITE_SENTRY_DEV_ENABLED=false
VITE_ENABLE_PERFORMANCE=true

# App version (optional)
VITE_APP_VERSION=1.0.0
VITE_BUILD_NUMBER=1
```

### 2. Sentry Setup

1. Go to [Sentry.io](https://sentry.io) and create a new project
2. Choose "React" as your platform
3. Copy the DSN and add it to your environment variables
4. Configure alert rules for critical errors

### 3. Google Analytics Setup

1. Your GA4 property is already configured
2. Set up custom events and conversions in GA4
3. Configure audiences for user segmentation

## What We Track

### User Engagement
- Page views and navigation
- Session duration and frequency
- User retention and churn
- Feature adoption rates

### Feature Usage
- Race creation, updates, and completion
- Runner management (add, edit, delete)
- Timer operations (start, stop, pause)
- Team management (create, join, leave)
- Leaderboard views and interactions

### Performance Metrics
- Core Web Vitals (CLS, FID, FCP, LCP, TTFB)
- API response times
- Component render times
- Resource loading performance
- Navigation timing

### Error Tracking
- JavaScript errors and exceptions
- API failures and network errors
- Component crashes
- Performance degradation

### Business Metrics
- Active teams and users
- Races completed
- User registration and onboarding
- Revenue-impacting events

## Usage Examples

### Basic Analytics Hook

```tsx
import { useAnalytics } from '@/hooks/useAnalytics';

function MyComponent() {
  const { trackFeature, trackError, setUserId } = useAnalytics();

  useEffect(() => {
    // Track component usage
    trackFeature('MyComponent', 'component_mount');
  }, [trackFeature]);

  const handleAction = () => {
    try {
      // Your logic here
      trackFeature('action', 'button_click', { button_name: 'submit' });
    } catch (error) {
      trackError(error, { component: 'MyComponent' });
    }
  };

  return <button onClick={handleAction}>Click me</button>;
}
```

### Feature-Specific Tracking

```tsx
import { useRaceTracking, useTimerTracking } from '@/hooks/useAnalytics';

function RaceComponent() {
  const { trackRaceCreate, trackRaceUpdate } = useRaceTracking();
  const { trackTimerStart, trackTimerStop } = useTimerTracking();

  const createRace = () => {
    trackRaceCreate({
      race_id: 'race-123',
      race_name: 'Hood to Coast',
      team_size: 12
    });
  };

  const startTimer = () => {
    trackTimerStart({
      race_id: 'race-123',
      leg_number: 1,
      runner_id: 'runner-456'
    });
  };

  return (
    <div>
      <button onClick={createRace}>Create Race</button>
      <button onClick={startTimer}>Start Timer</button>
    </div>
  );
}
```

### Performance Monitoring

```tsx
import { measureAsyncPerformance } from '@/services/performance';

const fetchData = async () => {
  return await measureAsyncPerformance('api_call', async () => {
    const response = await fetch('/api/data');
    return response.json();
  });
};
```

### Error Tracking

```tsx
import { captureSentryError } from '@/services/sentry';

try {
  // Risky operation
} catch (error) {
  captureSentryError(error, {
    operation: 'data_fetch',
    component: 'Dashboard'
  }, {
    error_type: 'api_failure'
  });
}
```

## Best Practices

### 1. Privacy and Data Protection

- Never track personally identifiable information (PII)
- Use hashed or anonymized user IDs
- Respect user privacy preferences
- Follow GDPR and CCPA compliance

### 2. Performance Impact

- Analytics calls should be non-blocking
- Use sampling in production to reduce overhead
- Batch events when possible
- Monitor analytics performance impact

### 3. Error Handling

- Always wrap analytics calls in try-catch blocks
- Don't let analytics errors break your app
- Use fallback logging for critical events
- Monitor analytics service health

### 4. Event Naming

- Use consistent naming conventions
- Include context in event names
- Use descriptive parameter names
- Document custom events

### 5. Testing

- Test analytics in development
- Verify events in GA4 debug mode
- Monitor Sentry for test errors
- Use analytics testing tools

## Configuration

### Analytics Configuration

```typescript
// src/config/analytics.ts
export const ANALYTICS_CONFIG = {
  GA_MEASUREMENT_ID: 'G-E4PBDFCZQ5',
  ENABLE_ANALYTICS: import.meta.env.PROD,
  SENTRY_TRACES_SAMPLE_RATE: import.meta.env.PROD ? 0.1 : 1.0,
  // ... more config
};
```

### Performance Thresholds

```typescript
const PERFORMANCE_THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 }
};
```

## Monitoring and Alerts

### GA4 Alerts
- Set up alerts for significant drops in user engagement
- Monitor conversion funnel performance
- Track feature adoption rates

### Sentry Alerts
- Critical error rate increases
- Performance degradation
- New error patterns
- User impact alerts

### Custom Dashboards
- User engagement metrics
- Feature usage trends
- Performance over time
- Error rates and patterns

## Troubleshooting

### Common Issues

1. **Events not appearing in GA4**
   - Check if analytics is enabled
   - Verify GA4 configuration
   - Check browser console for errors

2. **Sentry not capturing errors**
   - Verify DSN is correct
   - Check environment configuration
   - Ensure Sentry is initialized

3. **Performance impact**
   - Enable sampling in production
   - Monitor analytics bundle size
   - Use performance budgets

### Debug Mode

Enable debug mode in development:

```typescript
// All analytics calls will be logged to console
VITE_ENABLE_ANALYTICS=true
VITE_SENTRY_DEV_ENABLED=true
```

## Next Steps

1. **Set up Sentry project** and add DSN to environment variables
2. **Configure GA4 custom events** for business-specific metrics
3. **Set up monitoring dashboards** for key metrics
4. **Create alert rules** for critical issues
5. **Train team** on analytics best practices
6. **Implement A/B testing** framework
7. **Add user feedback** collection

## Support

For questions or issues with the analytics implementation:

1. Check the console for error messages
2. Verify environment variable configuration
3. Test in development mode first
4. Review Sentry and GA4 documentation
5. Contact the development team

## Files Created/Modified

- `src/types/analytics.ts` - Analytics type definitions
- `src/services/analytics.ts` - Analytics service
- `src/services/sentry.ts` - Sentry integration
- `src/services/performance.ts` - Performance monitoring
- `src/hooks/useAnalytics.ts` - React hooks for analytics
- `src/config/analytics.ts` - Configuration
- `src/components/AnalyticsExample.tsx` - Usage examples
- `src/main.tsx` - Service initialization
- `src/components/ErrorBoundary.tsx` - Enhanced error tracking
- `package.json` - Added dependencies
- `index.html` - Added GA4 script
