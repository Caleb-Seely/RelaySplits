# Database Schema Gotchas and Lessons Learned

## Issue: Team Start Time Defaulting to Current Time

### Problem Description
When creating a new team, the `start_time` field was being set to the current time instead of the intended placeholder value (`2099-12-31T23:59:59Z`). This caused the auto-start logic to trigger immediately, thinking the race had started.

### Root Cause
The database schema had a default value for the `start_time` column:
```sql
start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
```

When the Edge Function tried to insert a team with an explicit `start_time` value, the database was either:
1. Ignoring the provided value and using the default `NOW()`
2. Or there was a constraint/trigger overriding the value

### Investigation Process
1. **Initial Misdiagnosis**: Thought the issue was in the auto-start logic in `Index.tsx`
2. **Second Misdiagnosis**: Thought the issue was in the Dashboard display logic
3. **Third Misdiagnosis**: Thought the issue was in race store synchronization
4. **Final Diagnosis**: Traced the issue to the database schema and team creation process

### Key Lessons Learned

#### 1. Database Default Values Can Override Explicit Values
- Always check the database schema for default values when inserting data
- Default values like `DEFAULT NOW()` can override explicit values in INSERT statements
- Use `ALTER TABLE` to remove unwanted defaults if they conflict with business logic

#### 2. Edge Function Logging is Essential
- Add comprehensive logging to Edge Functions for debugging
- Log both input values and database results
- Use structured logging with clear prefixes for easy filtering

#### 3. Trace Data Flow from Source to Display
- When debugging data issues, trace the complete flow:
  - Database schema → Edge Function → localStorage → Race Store → UI Display
- Don't assume the issue is in the display layer without checking the data source

#### 4. Database Schema vs Migration Files
- The actual database schema might differ from migration files
- Always verify the current schema in the database
- Use `\d table_name` in PostgreSQL to see current column definitions

### Prevention Strategies

#### 1. Schema Review Checklist
Before deploying any database changes, review:
- [ ] Are there any `DEFAULT` values that could conflict with business logic?
- [ ] Are there any triggers that might override inserted values?
- [ ] Do the column constraints match the intended behavior?

#### 2. Edge Function Best Practices
- Always log input parameters and database results
- Use explicit value setting rather than relying on defaults
- Add validation to ensure values are set correctly

#### 3. Testing Strategy
- Test team creation with different scenarios
- Verify that placeholder values are properly stored
- Check that the auto-start logic uses the correct values

### Code Examples

#### Good: Explicit Value Setting with Logging
```typescript
// Edge Function
const placeholderStartTime = new Date('2099-12-31T23:59:59Z').toISOString();
console.log('[teams-create] Creating team with placeholder start_time:', placeholderStartTime);

const { data: team, error: teamError } = await supabase
  .from('teams')
  .insert({
    name: name.trim(),
    start_time: placeholderStartTime, // Explicit value
    // ... other fields
  })
  .select()
  .single()

console.log('[teams-create] Team created successfully:', {
  id: team.id,
  start_time: team.start_time,
  // ... other fields
});
```

#### Bad: Relying on Database Defaults
```typescript
// This can be overridden by database defaults
const { data: team, error: teamError } = await supabase
  .from('teams')
  .insert({
    name: name.trim(),
    // start_time not explicitly set - relies on database default
  })
  .select()
  .single()
```

### Database Schema Recommendations

#### 1. Avoid Problematic Defaults
```sql
-- ❌ Bad: Default to current time for fields that should be set explicitly
start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

-- ✅ Good: No default, require explicit value
start_time TIMESTAMP WITH TIME ZONE NOT NULL,

-- ✅ Good: Default to a clear placeholder value
start_time TIMESTAMP WITH TIME ZONE DEFAULT '2099-12-31T23:59:59Z'::timestamptz,
```

#### 2. Use Clear Placeholder Values
```sql
-- Use a far-future date that's clearly a placeholder
ALTER TABLE teams ALTER COLUMN start_time SET DEFAULT '2099-12-31T23:59:59Z'::timestamptz;
```

### Debugging Checklist

When investigating data issues:

1. **Check the Database Schema**
   - What are the column definitions?
   - Are there any default values?
   - Are there any triggers or constraints?

2. **Check the Edge Function Logs**
   - What values are being sent to the database?
   - What values are being returned from the database?
   - Are there any errors or warnings?

3. **Check the Data Flow**
   - Database → Edge Function → localStorage → Race Store → UI
   - At which step does the data become incorrect?

4. **Check for Race Conditions**
   - Are multiple processes trying to set the same value?
   - Is there proper synchronization?

### Related Files
- `supabase/functions/teams-create/index.ts` - Team creation Edge Function
- `src/hooks/useTeamSync.ts` - Team synchronization logic
- `src/store/raceStore.ts` - Race state management
- `src/components/SetupWizard.tsx` - Team setup wizard
- `src/pages/Index.tsx` - Auto-start logic

### Future Considerations
- Consider adding database constraints to prevent invalid start times
- Add validation in Edge Functions to ensure data integrity
- Implement comprehensive testing for team creation scenarios
- Consider using database transactions for multi-step operations
