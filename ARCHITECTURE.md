# RelaySplits Architecture Documentation

## 📁 **File Structure & Purpose**

This document provides a comprehensive overview of every file in the RelaySplits codebase, their purposes, and how they interact. This ensures consistency and prevents errors during future changes.

---

## 🏗️ **Root Level Files**

### **Configuration Files**
- **`package.json`** - Project dependencies, scripts, and metadata
- **`vite.config.ts`** - Vite build configuration and plugins
- **`tailwind.config.ts`** - Tailwind CSS configuration and custom styles
- **`tsconfig.json`** - TypeScript compiler configuration
- **`tsconfig.app.json`** - App-specific TypeScript configuration
- **`tsconfig.node.json`** - Node.js TypeScript configuration
- **`eslint.config.js`** - ESLint code quality rules
- **`postcss.config.js`** - PostCSS processing configuration
- **`components.json`** - shadcn/ui component configuration
- **`netlify.toml`** - Netlify deployment configuration

### **Documentation Files**
- **`README.md`** - Main project documentation and setup guide
- **`CONTRIBUTING.md`** - Development guidelines and contribution process
- **`ARCHITECTURE.md`** - This file - comprehensive architecture documentation
- **`SOFTWARE_ANALYSIS_AND_OBJECTIVES.md`** - High-level software analysis

### **Data & Testing Files**
- **`sample_runners.csv`** - Sample runner data for testing and demos
- **`*.md` files** - Various documentation files for features and fixes

---

## 📂 **Source Directory (`src/`)**

### **🎯 Entry Points**
- **`main.tsx`** - Application entry point, renders React app to DOM
- **`App.tsx`** - Root React component, sets up routing and providers
- **`index.css`** - Global CSS styles and Tailwind imports
- **`vite-env.d.ts`** - Vite environment type definitions

### **🏃‍♀️ Core Components (`src/components/`)**

#### **Main Application Components**
- **`Dashboard.tsx`** - **PRIMARY COMPONENT** - Main race tracking interface with real-time updates
- **`SetupWizard.tsx`** - 3-step race configuration wizard (start time, runners, legs)
- **`ViewOnlyDashboard.tsx`** - Read-only dashboard for spectators and view-only access
- **`DemoLanding.tsx`** - Landing page for demo and marketing purposes

#### **Race Management Components**
- **`RaceTimer.tsx`** - Live race timer with elapsed time display
- **`LegScheduleTable.tsx`** - Detailed leg schedule with editing capabilities
- **`MajorExchanges.tsx`** - Special tracking for van exchange points
- **`PaceInputModal.tsx`** - Modal for entering runner paces with validation
- **`RunnerAssignmentModal.tsx`** - Modal for assigning runners to legs
- **`RunnerEditModal.tsx`** - Modal for editing runner information

#### **Team & Sync Components**
- **`TeamSettings.tsx`** - Team configuration and management interface
- **`SyncStatusIndicator.tsx`** - Visual indicator for sync status and connectivity
- **`ConflictResolutionModal.tsx`** - Modal for resolving data conflicts
- **`SpreadsheetImport.tsx`** - Excel/CSV import functionality with column mapping

#### **UI & Utility Components**
- **`ErrorBoundary.tsx`** - React error boundary for graceful error handling
- **`InstallPrompt.tsx`** - PWA installation prompt component
- **`QuickHelpPopup.tsx`** - Contextual help and guidance popup
- **`DashboardPrompts.tsx`** - Prompts and notifications for dashboard users
- **`NotificationDiagnostics.tsx`** - Debug interface for notification system
- **`AdminRecovery.tsx`** - Admin recovery and management interface
- **`AdminSecretDisplay.tsx`** - Secure display of admin secrets

#### **UI Component Library (`src/components/ui/`)**
- **`accordion.tsx`** - Collapsible content sections
- **`alert.tsx`** - Alert/notification components
- **`alert-dialog.tsx`** - Confirmation dialogs
- **`avatar.tsx`** - User avatar components
- **`badge.tsx`** - Status and label badges
- **`button.tsx`** - Button components with variants
- **`calendar.tsx`** - Date picker calendar
- **`card.tsx`** - Card layout components
- **`checkbox.tsx`** - Checkbox input components
- **`collapsible.tsx`** - Collapsible content
- **`command.tsx`** - Command palette interface
- **`context-menu.tsx`** - Right-click context menus
- **`dialog.tsx`** - Modal dialog components
- **`dropdown-menu.tsx`** - Dropdown menu components
- **`form.tsx`** - Form components with validation
- **`hover-card.tsx`** - Hover-triggered cards
- **`input.tsx`** - Input field components
- **`label.tsx`** - Form labels
- **`menubar.tsx`** - Application menu bars
- **`navigation-menu.tsx`** - Navigation components
- **`popover.tsx`** - Popover components
- **`progress.tsx`** - Progress bar components
- **`radio-group.tsx`** - Radio button groups
- **`scroll-area.tsx`** - Custom scrollable areas
- **`select.tsx`** - Select dropdown components
- **`separator.tsx`** - Visual separators
- **`sheet.tsx`** - Slide-out sheet components
- **`skeleton.tsx`** - Loading skeleton components
- **`slider.tsx`** - Slider input components
- **`switch.tsx`** - Toggle switch components
- **`table.tsx`** - Table components
- **`tabs.tsx`** - Tabbed interface components
- **`textarea.tsx`** - Multi-line text input
- **`toast.tsx`** - Toast notification components
- **`toggle.tsx`** - Toggle button components
- **`toggle-group.tsx`** - Toggle button groups
- **`tooltip.tsx`** - Tooltip components
- **`use-toast.ts`** - Toast hook for notifications

### **🔄 State Management (`src/store/`)**
- **`raceStore.ts`** - **PRIMARY STORE** - Main race data and state management using Zustand
- **`raceDataStore.ts`** - Race data persistence and synchronization
- **`raceBusinessStore.ts`** - Business logic and race calculations
- **`raceUIStore.ts`** - UI state and user interface management
- **`useRaceStore.ts`** - Custom hook for accessing race store

### **🎣 Custom Hooks (`src/hooks/`)**
- **`useEnhancedSyncManager.ts`** - **CRITICAL** - Real-time synchronization and conflict resolution
- **`useTeamSync.ts`** - Team data synchronization and management
- **`useTeamManagement.ts`** - Team creation, joining, and management
- **`useOfflineQueue.ts`** - Offline change queuing and synchronization
- **`usePWA.ts`** - Progressive Web App functionality and installation
- **`useDecoupledNotifications.ts`** - Push notification management
- **`useQuickHelp.ts`** - Contextual help system
- **`use-mobile.tsx`** - Mobile device detection and optimization
- **`use-toast.ts`** - Toast notification system

### **🌐 Context Providers (`src/contexts/`)**
- **`TeamContext.tsx`** - **CRITICAL** - Team and device information context
- **`ConflictResolutionContext.tsx`** - Conflict resolution state and handlers

### **🔧 Utilities (`src/utils/`)**

#### **Core Race Logic**
- **`raceUtils.ts`** - **CRITICAL** - Core race calculations, timing, and utilities
- **`legData.ts`** - **CRITICAL** - Leg distances, locations, and race course data
- **`validation.ts`** - Data validation schemas and functions
- **`concurrency.ts`** - Concurrency control and race condition prevention

#### **Synchronization & Data**
- **`syncOptimizer.ts`** - Sync performance optimization
- **`eventBus.ts`** - **CRITICAL** - Event system for real-time communication
- **`logger.ts`** - Logging system for debugging and monitoring
- **`retry.ts`** - Retry logic for network operations
- **`rateLimiter.ts`** - API rate limiting and throttling

#### **User Experience**
- **`notifications.ts`** - **CRITICAL** - Push notification system
- **`notificationTest.ts`** - Notification testing utilities
- **`celebrationMessages.ts`** - Dynamic celebration and motivation messages
- **`confetti.ts`** - Confetti animation for celebrations
- **`quickHelp.ts`** - Help system content and logic

#### **System & Performance**
- **`serviceWorker.ts`** - Service worker registration and management
- **`diagnostics.ts`** - System diagnostics and health checks
- **`syncTest.ts`** - Sync system testing utilities
- **`demoData.ts`** - Demo and test data generation

### **🗄️ Database Integration (`src/integrations/supabase/`)**
- **`client.ts`** - **CRITICAL** - Supabase client configuration and initialization
- **`edge.ts`** - Edge function utilities and device management
- **`types.ts`** - **CRITICAL** - Database schema types and interfaces

### **🕐 Services (`src/services/`)**
- **`clockSync.ts`** - **CRITICAL** - Server time synchronization for accurate timing

### **📄 Pages (`src/pages/`)**
- **`Index.tsx`** - Main landing page and routing logic
- **`NotFound.tsx`** - 404 error page

### **📝 Type Definitions (`src/types/`)**
- **`race.ts`** - **CRITICAL** - Core race data types and interfaces
- **`sentry.d.ts`** - Sentry error tracking type definitions

---

## 🗄️ **Backend (`supabase/`)**

### **🔧 Edge Functions (`supabase/functions/`)**

#### **Team Management**
- **`teams-create/index.ts`** - **CRITICAL** - Team creation with secure token generation
- **`teams-get/index.ts`** - Team data retrieval
- **`teams-update/index.ts`** - Team information updates
- **`teams-join/index.ts`** - Team joining via invite codes
- **`teams-view/index.ts`** - View-only team access
- **`teams-rotate-invite/index.ts`** - Invite token rotation
- **`teams-fix-invite-token/`** - Invite token repair utilities

#### **Race Data Management**
- **`runners-upsert/index.ts`** - **CRITICAL** - Runner data creation and updates
- **`runners-list/index.ts`** - Runner data retrieval
- **`legs-upsert/index.ts`** - **CRITICAL** - Leg data creation and updates
- **`legs-list/index.ts`** - Leg data retrieval

#### **System Services**
- **`server-time/index.ts`** - **CRITICAL** - Server time synchronization endpoint
- **`ping/index.ts`** - Health check and connectivity testing
- **`devices-list/index.ts`** - Device management
- **`devices-remove/index.ts`** - Device removal and cleanup

#### **Data Management**
- **`backups-list/index.ts`** - Backup data retrieval
- **`backups-upsert/index.ts`** - Backup data creation and updates
- **`admin-recovery/index.ts`** - Admin recovery operations
- **`test-schema/index.ts`** - Database schema testing

### **🗄️ Database Migrations (`supabase/migrations/`)**
- **`20250110000000_create_backups_table.sql`** - Backup system table creation
- **`20250115000000_add_performance_indexes.sql`** - Performance optimization indexes
- **`20250809112741_c6b442ac-3e5b-4d59-b2b5-41c4b196dff0.sql`** - Initial schema setup
- **`20250812033752_0e2b53b0-a1e8-4bf9-b694-62855757178c.sql`** - Schema updates
- **`20250814051901_fix_team_members_select_policy.sql`** - Security policy fixes
- **`20250814052630_break_policy_cycle.sql`** - Policy dependency resolution
- **`20250814194200_add_team_secrets_and_devices.sql`** - Team security features
- **`20250814195500_remove_owner_not_null.sql`** - Schema flexibility updates
- **`20250814222513_rls_lockdown_phase3.sql`** - Row Level Security implementation
- **`20250815000000_make_owner_id_optional_for_team_model.sql`** - Team model updates
- **`20250815000001_remove_owner_id_from_teams.sql`** - Team ownership changes
- **`20250815000002_add_viewer_role.sql`** - Role-based access control
- **`20250815000003_revert_invite_token_to_uuid.sql`** - Token format standardization

### **⚙️ Configuration**
- **`config.toml`** - Supabase project configuration

---

## 🌐 **Public Assets (`public/`)**

### **📱 PWA Assets**
- **`manifest.json`** - PWA manifest for app installation
- **`sw.js`** - Service worker for offline functionality
- **`robots.txt`** - Search engine crawling rules
- **`_redirects`** - Netlify redirect rules

### **🎨 Icons & Images**
- **`favicon.ico`** - Browser favicon
- **`favicon.png`** - High-resolution favicon
- **`apple-touch-icon.png`** - iOS app icon
- **`icon-*.png`** - Various app icons for different platforms
- **`AppImages/`** - Platform-specific app icons and splash screens

### **🧪 Testing & Development**
- **`test-mobile-notifications.html`** - Mobile notification testing
- **`placeholder.svg`** - Placeholder image
- **`time-line.svg`** - Timeline visualization asset

---

## 🧪 **Testing Files**

### **Test Scripts**
- **`test-*.js`** - Various test scripts for different features
- **`analyze-sync-issue.js`** - Sync issue analysis
- **`fix-race-logic.js`** - Race logic fixes
- **`simple-test.js`** - Simple functionality tests
- **`verify-fix.js`** - Fix verification scripts

### **SQL Files**
- **`fix_invite_tokens.sql`** - Database fix scripts
- **`test_invite_token_format.sql`** - Token format testing

---

## 🔗 **File Dependencies & Relationships**

### **Critical Dependencies**
```
main.tsx
├── App.tsx
│   ├── TeamProvider (TeamContext.tsx)
│   ├── ConflictResolutionProvider (ConflictResolutionContext.tsx)
│   └── Routes
│       ├── Index.tsx
│       │   ├── Dashboard.tsx (PRIMARY)
│       │   │   ├── useRaceStore (raceStore.ts)
│       │   │   ├── useEnhancedSyncManager (useEnhancedSyncManager.ts)
│       │   │   ├── useTeamSync (useTeamSync.ts)
│       │   │   └── raceUtils.ts
│       │   └── SetupWizard.tsx
│       └── ViewOnlyDashboard.tsx
└── supabase client.ts
```

### **Data Flow**
```
User Input → Component → Store → Hook → Supabase → Real-time → All Devices
```

### **Critical Files for Changes**
When making changes, always consider these files:
1. **`src/types/race.ts`** - Update types first
2. **`src/store/raceStore.ts`** - Update store logic
3. **`src/utils/raceUtils.ts`** - Update business logic
4. **`src/components/Dashboard.tsx`** - Update UI
5. **`src/integrations/supabase/types.ts`** - Update database types
6. **`supabase/functions/*/index.ts`** - Update backend logic

---

## ⚠️ **Change Guidelines**

### **Before Making Changes**
1. **Check types first** - Update `src/types/race.ts` if adding new data structures
2. **Update store** - Modify `src/store/raceStore.ts` for new state management
3. **Update utils** - Add business logic to `src/utils/raceUtils.ts`
4. **Update database** - Modify `src/integrations/supabase/types.ts` and migrations
5. **Update UI** - Modify components to use new functionality
6. **Test thoroughly** - Use test scripts to verify changes

### **Critical Areas**
- **Timing logic** - Always use `clockSync.ts` for accurate timing
- **Sync operations** - Use `useEnhancedSyncManager.ts` for all data changes
- **Validation** - Use `validation.ts` schemas for all data
- **Error handling** - Use `ErrorBoundary.tsx` and proper error states
- **Offline support** - Ensure all changes work offline via `useOfflineQueue.ts`

### **Performance Considerations**
- **Debounce sync operations** - Use rate limiting in `rateLimiter.ts`
- **Cache frequently accessed data** - Use caching strategies
- **Lazy load components** - Use React.lazy for code splitting
- **Optimize re-renders** - Use React.memo and useMemo appropriately

---

## 🔍 **Troubleshooting Guide**

### **Common Issues**
1. **Sync conflicts** - Check `ConflictResolutionContext.tsx` and `useEnhancedSyncManager.ts`
2. **Timing issues** - Verify `clockSync.ts` and server time synchronization
3. **Offline problems** - Check `useOfflineQueue.ts` and service worker
4. **Notification issues** - Debug with `NotificationDiagnostics.tsx`
5. **Performance problems** - Monitor with `diagnostics.ts`

### **Debug Tools**
- **`NotificationDiagnostics.tsx`** - Notification system debugging
- **`diagnostics.ts`** - System health monitoring
- **`logger.ts`** - Comprehensive logging system
- **`syncTest.ts`** - Sync system testing

---

This architecture documentation ensures consistency and prevents errors by clearly defining the purpose and relationships of every file in the codebase.
