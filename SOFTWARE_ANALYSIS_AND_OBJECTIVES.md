# RelaySplits: Software Analysis and Objectives

## 🎯 **Primary Objective**

RelaySplits is a **real-time relay race management system** designed to coordinate and track multi-leg relay races, with a primary focus on the Hood to Coast relay race. The system enables teams to manage 12 runners across 2 vans, track 36 legs in real-time, and coordinate handoffs with precise timing and synchronization.

## 🏗️ **Core Architecture Overview**

### **Technology Stack**
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn/ui + Tailwind CSS
- **State Management**: Zustand
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Real-time**: Supabase Realtime subscriptions
- **PWA**: Service Worker + Push Notifications
- **Data Validation**: Zod schemas
- **File Processing**: XLSX + PapaParse for spreadsheet imports

### **Key Components**

```
RelaySplits/
├── Frontend (React SPA)
│   ├── Dashboard - Main race tracking interface
│   ├── SetupWizard - 3-step race configuration
│   ├── Real-time sync - Multi-device coordination
│   └── PWA features - Offline + notifications
├── Backend (Supabase)
│   ├── PostgreSQL database - Race data storage
│   ├── Edge Functions - Team management + sync
│   ├── Realtime subscriptions - Live updates
│   └── Row Level Security - Team isolation
└── Supporting Systems
    ├── Clock synchronization - Time accuracy
    ├── Offline queue - Network resilience
    ├── Conflict resolution - Data consistency
    └── Backup systems - Data protection
```

## 🏃‍♀️ **Core Functionality**

### **1. Race Setup & Configuration**
- **3-Step Wizard**: Guided setup for race start time, team configuration, and leg distances
- **Team Management**: Configure 12 runners with names, paces, and van assignments
- **Data Import**: Import runner data from Excel/CSV files with smart column mapping
- **Pace Management**: Support for MM:SS pace format with validation
- **Leg Customization**: Default Hood to Coast distances (36 legs) or custom configurations

### **2. Real-Time Race Tracking**
- **Live Dashboard**: Real-time updates showing current runner, next runner, and race progress
- **Race Timer**: Continuous timer from start to finish with elapsed time display
- **Progress Tracking**: Visual progress bar showing completion percentage and distance traveled
- **Van Coordination**: Separate views for Van 1 and Van 2 with van-specific schedules
- **Status Indicators**: Color-coded status for each leg (Ready, Running, Finished, Next Up)

### **3. Multi-Device Synchronization**
- **Real-time Updates**: Changes sync instantly across all team devices
- **Conflict Resolution**: Automatic detection and resolution of conflicting updates
- **Offline Support**: Queue changes when offline, sync when connection restored
- **Device Management**: Track multiple devices per team with role-based access
- **Data Integrity**: Validation and consistency checks across all operations

### **4. Time Management & Accuracy**
- **Clock Synchronization**: Server time sync to prevent timing discrepancies
- **Projected vs Actual**: Track both projected finish times and actual performance
- **Dynamic Recalculation**: Automatic adjustment of future projections based on actual performance
- **Countdown Timers**: Live countdown to next runner start times
- **Major Exchanges**: Special tracking for van exchange points (legs 6, 12, 18, 24, 30, 36)

### **5. Team Coordination Features**
- **Push Notifications**: Runner start alerts, handoff notifications, race completion
- **View-Only Mode**: Share race progress with spectators via unique URLs
- **Team Invites**: Join codes and invite tokens for team access
- **Admin Controls**: Team management with admin secrets and device control
- **Data Export**: Export race data for post-race analysis

## 🔄 **Data Flow & Synchronization**

### **Real-Time Sync Architecture**
```
Device A (Runner 1)     Device B (Runner 2)     Device C (Spectator)
      │                        │                        │
      │ 1. Start Runner        │                        │
      │ 2. Update Leg Data     │                        │
      │ 3. Sync to Supabase    │                        │
      │                        │                        │
      └─────────────┬──────────┴──────────┬─────────────┘
                    │                     │
            Supabase Realtime        Supabase Realtime
                    │                     │
            ┌───────┴───────┐     ┌───────┴───────┐
            │   Device B    │     │   Device C    │
            │ Gets Update   │     │ Gets Update   │
            │ UI Refreshes  │     │ UI Refreshes  │
```

### **Conflict Resolution Process**
1. **Change Detection**: Device detects local change
2. **Validation**: Validate change against current state
3. **Sync Attempt**: Send change to server
4. **Conflict Check**: Server compares with existing data
5. **Resolution**: Automatic merge or manual conflict resolution
6. **Propagation**: Resolved data syncs to all devices

### **Offline Queue System**
```
Offline Queue Flow:
1. User makes change while offline
2. Change added to local queue
3. Queue persists in localStorage
4. Connection restored
5. Queue processed in order
6. Changes sync to server
7. Queue cleared
```

## 🗄️ **Database Schema**

### **Core Tables**
```sql
-- Teams (isolated by team_id)
teams: {
  id: uuid (primary key)
  name: text
  invite_token: uuid
  join_code: text
  admin_secret: text
  start_time: timestamp
  created_at: timestamp
}

-- Runners (belong to teams)
runners: {
  id: uuid (primary key)
  team_id: uuid (foreign key)
  name: text
  pace: integer (seconds per mile)
  van: text ('1' or '2')
  leg_ids: uuid[] (assigned legs)
  updated_at: timestamp
}

-- Legs (race segments)
legs: {
  id: uuid (primary key)
  team_id: uuid (foreign key)
  number: integer (1-36)
  runner_id: uuid (foreign key)
  distance: numeric (miles)
  start_time: timestamp
  finish_time: timestamp
  updated_at: timestamp
}

-- Devices (team members)
devices: {
  id: uuid (primary key)
  team_id: uuid (foreign key)
  device_id: text
  role: text ('admin', 'member', 'viewer')
  display_name: text
  created_at: timestamp
}
```

## 🔐 **Security & Access Control**

### **Row Level Security (RLS)**
- **Team Isolation**: All data scoped to team_id
- **Device Authentication**: Device-based access control
- **Role-Based Permissions**: Admin, member, and viewer roles
- **Invite System**: Secure team joining via tokens/codes

### **Data Protection**
- **Local Backups**: Critical timing data backed up locally
- **Validation**: All data validated with Zod schemas
- **Conflict Detection**: Automatic detection of conflicting changes
- **Audit Trail**: Timestamp tracking for all changes

## 📱 **Progressive Web App Features**

### **PWA Capabilities**
- **Offline Functionality**: Works without internet connection
- **Push Notifications**: Real-time alerts for race events
- **App Installation**: Install as native app on mobile devices
- **Background Sync**: Sync data when app is closed
- **Service Worker**: Caching and offline support

### **Notification System**
- **Runner Start Alerts**: "Runner 1 is starting Leg 1!"
- **Handoff Notifications**: "Runner 1 finished! Runner 2 is starting Leg 2!"
- **Race Events**: "And they're off!" (race start), "Final runner heading to finish!"
- **Permission Management**: Easy notification permission handling

## 🎯 **Use Cases & Scenarios**

### **Primary Use Case: Hood to Coast Relay**
- **36 legs** across 200+ miles
- **12 runners** in 2 vans
- **24+ hours** of continuous racing
- **Multiple exchange points** requiring coordination
- **Variable cell coverage** requiring offline capability

### **Team Coordination Scenarios**
1. **Van 1 Runner 1** starts leg, all devices update instantly
2. **Van 2** receives notification of handoff timing
3. **Spectators** can view progress via view-only URLs
4. **Offline devices** queue changes and sync when online
5. **Conflicts** automatically resolved or presented for manual resolution

### **Race Management Scenarios**
1. **Setup**: Import team data, configure race parameters
2. **Pre-race**: Final adjustments, team coordination
3. **During race**: Real-time tracking, timing updates
4. **Post-race**: Data export, performance analysis

## 🚀 **Performance & Scalability**

### **Optimization Strategies**
- **Caching**: Local caching of frequently accessed data
- **Debouncing**: Rate limiting for sync operations
- **Lazy Loading**: Code splitting for better performance
- **Indexing**: Database indexes on frequently queried fields
- **Compression**: Efficient data transfer and storage

### **Scalability Considerations**
- **Team Isolation**: Each team operates independently
- **Device Limits**: Reasonable limits on devices per team
- **Data Retention**: Automatic cleanup of old data
- **Resource Management**: Conservative memory and storage usage

## 🔧 **Development & Deployment**

### **Development Workflow**
- **TypeScript**: Full type safety and enhanced DX
- **ESLint**: Code quality and consistency
- **Testing**: Vitest for unit and integration tests
- **Hot Reload**: Fast development with Vite
- **Git Workflow**: Feature branches and PR reviews

### **Deployment Strategy**
- **Netlify**: Frontend hosting with automatic deployments
- **Supabase**: Backend hosting with edge functions
- **Environment Management**: Separate dev/staging/prod environments
- **Monitoring**: Error tracking and performance monitoring

## 📊 **Current State & Roadmap**

### **Production Ready Features**
- ✅ Complete race setup and configuration
- ✅ Real-time multi-device synchronization
- ✅ Offline capability and queue system
- ✅ Push notifications and PWA features
- ✅ Conflict resolution and data validation
- ✅ Team management and access control
- ✅ Data import/export functionality

### **Recent Improvements (Phase 1)**
- ✅ Clock synchronization for timing accuracy
- ✅ Local backup system for data protection
- ✅ Enhanced error handling and recovery
- ✅ Performance optimizations and caching
- ✅ Production readiness improvements

### **Future Enhancements (Phase 2)**
- 🔄 Advanced clock sync with drift compensation
- 🔄 Cloud backup and recovery systems
- 🔄 Network quality monitoring
- 🔄 Optimistic updates for better UX
- 🔄 Advanced analytics and reporting

## 🎉 **Success Metrics**

### **User Experience**
- **Setup Time**: < 5 minutes for complete race configuration
- **Sync Latency**: < 2 seconds for real-time updates
- **Offline Reliability**: 100% functionality without internet
- **Error Rate**: < 1% for critical timing operations

### **Technical Performance**
- **Load Time**: < 3 seconds for initial app load
- **Memory Usage**: < 50MB for typical usage
- **Battery Impact**: Minimal impact on mobile devices
- **Data Accuracy**: 100% timing accuracy with clock sync

### **Team Adoption**
- **Ease of Use**: Intuitive interface requiring minimal training
- **Reliability**: Consistent performance across all devices
- **Coordination**: Improved team communication and timing
- **Satisfaction**: High user satisfaction and retention

---

**RelaySplits represents a comprehensive solution for relay race management, combining real-time coordination, offline reliability, and user-friendly design to create an essential tool for relay race teams.**
