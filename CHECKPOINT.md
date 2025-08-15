# RelaySplits – Team-Based Access Refactor Checkpoint (2025-08-14)

## Project Goal & Current Status
The primary objective is to refactor the application from a user-based Supabase authentication model to a secure, team-based access model. Access control is handled exclusively by Supabase Edge Functions, with no direct table access from the client.

**Current Status: Core Refactor Complete.** The application is now fully functional using a team/device identity model. Users can successfully create and join teams, and the data synchronization for runners and legs is working through Edge Functions. The next phase focuses on adding team administration features and realtime push updates.

---

## Guide for Next Steps

This guide is for the next AI assistant to seamlessly continue development.

### Immediate Priorities
1.  **Implement Team Management Features**: This is the most critical next step.
    *   **Backend**: Create Edge Functions for:
        *   `teams-update`: To modify team `name` or `start_time`.
        *   `devices-list`: To list all devices associated with a team.
        *   `devices-remove`: For an admin to remove another device from the team.
        *   `admin-recovery`: To implement a one-time admin recovery code mechanism.
    *   **Frontend**: Build a `TeamSettings` page or component where an admin can:
        *   View and rotate the team's invite link/code.
        *   See a list of team members (devices) and remove them.
        *   Update the team name and race start time.

2.  **Implement Realtime Updates via Supabase Broadcast**:
    *   **Backend**: In the `runners-upsert` and `legs-upsert` Edge Functions, after a successful database write, send a message via Supabase Broadcast to a team-specific channel (e.g., `team-<teamId>`).
    *   **Frontend**: In `useSyncManager.ts`, subscribe to the Broadcast channel upon joining a team. When a message is received, trigger a data reconciliation (refetch) to get the latest updates. This replaces the disabled Postgres Changes subscription.

### How to Run & Test
1.  **Install dependencies**: `npm install`
2.  **Run the development server**: `npm run dev`
3.  **Environment**: Ensure a `.env` file exists with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4.  **Testing Flow**:
    *   Navigate to the app (usually `/auth` or `/`).
    *   Use the "Create Team" form. Upon success, you will be taken to the dashboard.
    *   Copy the invite link or join code.
    *   In a different browser or incognito window, use the "Join Team" form with the copied code/link.

---

## Detailed Checkpoint

### Completed & Verified
*   **Full Frontend Refactor**:
    *   `AuthContext` has been completely removed and replaced with `TeamContext`.
    *   `useTeamSync.ts` handles team creation and joining via Edge Functions, storing team/device info in local storage.
    *   `useSyncManager.ts` fetches and sends all race data (`runners`, `legs`) through Edge Functions.
    *   The UI has been updated to remove login/signup screens in favor of a `TeamOnboarding` component.
*   **Core Edge Functions (Deployed & Working)**:
    *   `teams-create`: Creates a team, generates secrets, and returns an invite token/code.
    *   `teams-join`: Allows a new device to join a team using an invite token or a short code. Handles URL parsing and case-insensitive code matching.
    *   `runners-list` / `legs-list`: Provide read access to team data.
    *   `runners-upsert` / `legs-upsert`: Handle all data writes, including server-side ID generation and audit logging.
*   **Database & Security**:
    *   **RLS Lockdown**: All direct client access to tables (`teams`, `runners`, `legs`, etc.) is blocked. RLS policies are in place, and `anon`/`authenticated` roles have no grants.
    *   **Service Role Key**: All Edge Functions use the `SERVICE_ROLE_KEY` for privileged database access.
*   **Debugging & Fixes**:
    *   Resolved 400 error on `teams-create` by aligning frontend payload.
    *   Resolved 404 error on `teams-join` by ensuring correct deployment.
    *   Resolved "Invalid token" error by implementing robust input parsing on the client and case-insensitive matching on the backend.

### Pending Tasks
*   **Team Management Features** (see "Immediate Priorities").
*   **Realtime via Broadcast** (see "Immediate Priorities").
*   **Schema Finalization**:
    *   Add database indexes for `teams.invite_token` and `teams.join_code`.
    *   Consider a case-insensitive index for `join_code`.
*   **UX & UI Polish**:
    *   Implement user preference for tighter padding on small screens (`LegScheduleTable`).
    *   Consider UI for displaying "last seen" status for devices.
*   **Testing**:
    *   Write tests for edge cases: multi-device sync conflicts, offline behavior, admin actions.

### Key Design Decisions
*   **Stateless Backend**: Edge Functions are the source of truth for access control.
*   **Device-as-Identity**: A stable, locally stored `deviceId` is the primary identifier for actions.
*   **Optimistic UI + Polling**: The frontend updates immediately and reconciles with the backend via periodic polling (currently 60s) until Broadcast is implemented.

### Test Commands (PowerShell)
*Note: Set `$env:SUPA_URL`, `$env:SUPABASE_ANON_KEY`, `$env:TEAM_ID`, `$env:DEVICE_ID_ADMIN`.*

- **Create Team**
```powershell
curl -sS -X POST "$env:SUPA_URL/functions/v1/teams-create" `
  -H "Authorization: Bearer $env:SUPABASE_ANON_KEY" `
  -H "Content-Type: application/json" `
  -d '{"name":"Test Team","device_profile":{"first_name":"Admin","last_name":"User"}}'
```

- **Join Team (using invite_token)**
```powershell
curl -sS -X POST "$env:SUPA_URL/functions/v1/teams-join" `
  -H "Authorization: Bearer $env:SUPABASE_ANON_KEY" `
  -H "Content-Type: application/json" `
  -d '{"invite_token":"YOUR_INVITE_TOKEN","device_profile":{"first_name":"New","last_name":"Member"}}'
```
