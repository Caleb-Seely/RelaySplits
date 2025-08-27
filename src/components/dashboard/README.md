# Dashboard Components

This directory contains the modular components that make up the Dashboard functionality. The original Dashboard component was over 2000 lines and handled many responsibilities. This refactoring breaks it down into smaller, more manageable components following React best practices.

## Structure

### Components

- **`Dashboard.tsx`** - Main Dashboard component that orchestrates all sub-components
- **`DashboardHeader.tsx`** - Header section with team name, progress bar, and sync status
- **`CurrentRunnerCard.tsx`** - Card displaying information about the currently running athlete
- **`NextRunnerCard.tsx`** - Card displaying information about the next runner and race completion state
- **`VanToggle.tsx`** - Toggle component for switching between Van 1 and Van 2 views
- **`LegScheduleSection.tsx`** - Section containing the leg schedule table with view mode toggle
- **`DashboardFooter.tsx`** - Footer with settings, notifications, and various action buttons

### Custom Hook

- **`useDashboard.ts`** - Custom hook that contains all the complex logic, state management, and event handlers

## Benefits of This Refactoring

### 1. **Separation of Concerns**
- Each component has a single, well-defined responsibility
- Logic is separated from presentation
- Business logic is centralized in the custom hook

### 2. **Maintainability**
- Smaller files are easier to understand and modify
- Changes to one component don't affect others
- Clear interfaces between components

### 3. **Reusability**
- Components can be reused in other parts of the application
- The custom hook can be used by other components that need similar functionality

### 4. **Testability**
- Each component can be tested in isolation
- The custom hook can be tested independently
- Mocking dependencies is easier

### 5. **Performance**
- Components can be optimized individually
- React can better optimize re-renders with smaller components
- Code splitting is easier

## Usage

The main Dashboard component is now a simple wrapper:

```tsx
import { Dashboard } from '@/components/dashboard';

<Dashboard isViewOnly={false} viewOnlyTeamName="Team Name" />
```

## Component Interfaces

### DashboardHeader
```tsx
interface DashboardHeaderProps {
  isViewOnly?: boolean;
  viewOnlyTeamName?: string;
  team?: any;
  actualRaceStartTime: number | null;
  currentTime: Date;
  isRaceComplete: () => boolean;
  getFinalRaceTime: () => number | null;
  onCheckMissingTimes: () => void;
  onCheckSingleRunnerRule: () => void;
  canEdit: boolean;
}
```

### CurrentRunnerCard
```tsx
interface CurrentRunnerCardProps {
  currentRunner: any;
  currentRunnerInfo: any;
  currentTime: Date;
  isCurrentRunnerLoading: boolean;
  getRemainingDistance: () => number;
}
```

### NextRunnerCard
```tsx
interface NextRunnerCardProps {
  nextRunner: any;
  nextRunnerInfo: any;
  currentTime: Date;
  actualRaceStartTime: number | null;
  legs: any[];
  isNextRunnerLoading: boolean;
  isDataLoading: boolean;
  isRaceComplete: () => boolean;
  canEdit: boolean;
  isStartingRunner: boolean;
  onStartRunner: () => void;
  onFinishRace: () => void;
  onCelebrate: () => void;
  getCountdownToNext: () => string | null;
  getNextRunnerPrefix: () => string;
  getEffectiveStartTime: (runner: any, legs: any[], startTime: number) => number;
  teamId: string;
}
```

## Custom Hook

The `useDashboard` hook encapsulates all the complex logic:

- State management for all dashboard-related state
- Event handlers for user interactions
- Data fetching and synchronization
- Race state calculations
- Utility functions

This makes the components pure and focused on presentation, while the hook handles all the business logic.

## Migration Notes

The original Dashboard component has been replaced with a simple wrapper that imports the new modular Dashboard. This ensures backward compatibility while providing the benefits of the new structure.

All existing functionality has been preserved, but it's now organized in a much more maintainable way.
