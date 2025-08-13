# RelaySplits (TeamSplits) — Product Overview

A modern, mobile-first web app for planning and tracking long-distance relay races in real time. Built for events like Hood to Coast, but flexible for any relay with customizable legs, teams, and pacing.

## What it does
- **Setup wizard**: Configure race start time, 12 runners, vans (Van 1 & Van 2), and leg distances (36-leg default, customizable).
- **Live tracking**: See the current runner, the next runner, countdowns, and leg progress with second-by-second updates.
- **Time management**: Record actual start/finish times, compare to projections, and auto-adjust future projections based on real performance.
- **Major exchanges**: Highlight and plan around key exchange points (6, 12, 18, 24, 30, 36).
- **Analytics at a glance**: Overall elapsed time, distance traveled, per-runner pace and leg times, and completion progress.
- **Collaboration**: Team-based access with cloud sync; simple sharing of Team ID.
- **Offline-ready**: Works without connectivity; changes sync when the device is back online.
- **Spreadsheet import**: Bring in runner rosters (names, paces, vans) from CSV/XLSX with smart mapping.

## Who it’s for
- **Team captains and drivers** coordinating multi-van relay teams.
- **Runners** wanting clear visibility into “who’s up” and when.
- **Support crews** managing handoffs, pacing, and logistics.

## How it works (high level)
- **Core objects**: `Team` → `Runners` (pace, van) → `Legs` (distance, runner assignment).
- **Projections vs actuals**: App calculates projected times from distance × pace. When you capture actual start/finish times, future legs recalibrate automatically.
- **Race clock**: The official race start time drives projections; leg 1 can auto-start at the official start if not set manually.
- **Current/next logic**: The dashboard determines the active leg from timestamps and shows the next leg with a countdown.
- **Major exchanges**: Special views summarize ETA and coordination needs at major exchange points.

## Key screens
- **Setup Wizard**: 3 steps for start time, runners & vans, and leg distances; optional spreadsheet import.
- **Dashboard**: Current runner card, next runner countdown, progress bar, team start time, distance traveled, sync status.
- **Leg Schedule Table**: Dense, editable schedule of all legs with status colors and quick actions (optimized with tighter padding on small screens).
- **Modals**: Time picker for precise time entry; runner edit and assignment tools; pace input helpers.

## Data and syncing
- **Cloud sync**: Uses Supabase for team and race state synchronization across devices.
- **Offline mode**: Local cache keeps the race going; pending changes are clearly indicated and synced later.
- **Import/export**: Import runners from CSV/XLSX; export race data after the event for analysis.

## Guardrails & access
- **Auth**: Users sign in to access their team(s).
- **Team sharing**: Share your Team ID to let others view/edit as needed.
- **Free window**: Supports a time-limited free usage period (e.g., 8 hours from start) with optional upgrade path.

## Design principles
- **Mobile-first, touch-friendly** UI that works great in vans and at exchanges.
- **Information-dense tables** on small screens to maximize visibility of the schedule.
- **Fast and reliable**: Real-time feel with performant state management and background sync.

## Tech at a glance
React + TypeScript, Vite, Zustand, Tailwind + shadcn/ui, date-fns, Supabase, PapaParse/XLSX, Lucide icons.

## One-liner elevator pitch
RelaySplits gives relay teams a live, shared source of truth for who’s running, who’s up next, and when each exchange will happen—online or offline, all race long.
