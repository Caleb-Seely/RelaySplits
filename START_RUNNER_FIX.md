# Start Runner Function Parameter Mismatch Fix

## Problem Analysis

The error `[startNextRunner] Invalid leg IDs: {currentRunnerId: 0, nextRunnerId: 1}` was occurring due to a parameter naming and logic mismatch in the `startNextRunner` function.

### Root Cause

1. **Parameter Naming Confusion**: The function was named with `currentRunnerId` and `nextRunnerId` parameters, but these were actually leg IDs, not runner IDs.

2. **Function Logic Mismatch**: The function expected leg IDs but the parameter names suggested runner IDs, leading to confusion in the calling code.

3. **First Leg Edge Case**: The special case where `currentLegId = 0` (representing the first leg scenario) wasn't properly handled.

## Solution Implemented

### 1. Parameter Name Clarification

**Before:**
```typescript
startNextRunner: (currentRunnerId: number, nextRunnerId: number) => void
```

**After:**
```typescript
startNextRunner: (currentLegId: number, nextLegId: number) => void
```

### 2. Enhanced Input Validation

Added comprehensive input validation to prevent invalid parameters:

```typescript
startNextRunner: (currentLegId: number, nextLegId: number) => set((state) => {
  // Validate input parameters
  if (typeof currentLegId !== 'number' || typeof nextLegId !== 'number') {
    console.warn('[startNextRunner] Invalid parameters:', { currentLegId, nextLegId });
    return state;
  }
  
  // ... rest of function
});
```

### 3. First Leg Scenario Handling

Added dedicated logic for the first leg scenario where `currentLegId = 0`:

```typescript
// Handle first leg scenario (currentLegId = 0)
if (currentLegId === 0) {
  // For first leg, we only need to validate nextLegId
  const nextLegIndex = state.legs.findIndex(leg => leg.id === nextLegId);
  
  if (nextLegIndex === -1) {
    console.warn('[startNextRunner] Invalid next leg ID for first leg scenario:', nextLegId);
    return state;
  }

  const nextLeg = state.legs[nextLegIndex];
  
  // Validate that this is actually the first leg
  if (nextLeg.id !== 1) {
    console.warn('[startNextRunner] First leg scenario but nextLegId is not 1:', nextLegId);
    return state;
  }

  // ... handle first leg start logic
}
```

### 4. Updated Calling Code

Updated the Dashboard component to use the correct variable names:

**Before:**
```typescript
const currentRunnerId = currentRunner?.id || 0; // Use 0 for first leg scenario
startNextRunner(currentRunnerId, nextRunner.id);
```

**After:**
```typescript
const currentLegId = currentRunner?.id || 0; // Use 0 for first leg scenario
startNextRunner(currentLegId, nextRunner.id);
```

## Key Improvements

### 1. **Clear Parameter Names**
- `currentLegId` and `nextLegId` clearly indicate these are leg IDs
- Eliminates confusion between runner IDs and leg IDs

### 2. **Comprehensive Validation**
- Type checking for input parameters
- Validation of leg existence in the state
- Logical validation of leg transitions

### 3. **Edge Case Handling**
- Proper handling of first leg scenario (`currentLegId = 0`)
- Validation that first leg scenario only applies to leg ID 1

### 4. **Better Error Messages**
- Clear, descriptive error messages for debugging
- Specific validation failures are logged

### 5. **Maintained Functionality**
- All existing race scenarios still work correctly
- No breaking changes to the API
- Backward compatibility maintained

## Testing Results

- ✅ Build completes successfully
- ✅ TypeScript compilation passes
- ✅ Parameter validation works correctly
- ✅ First leg scenario handled properly
- ✅ Error messages are clear and helpful

## Usage Examples

### Starting the First Leg
```typescript
// Start the first leg (leg ID 1)
startNextRunner(0, 1);
```

### Transitioning Between Legs
```typescript
// Transition from leg 5 to leg 6
startNextRunner(5, 6);
```

### Finishing the Final Leg
```typescript
// Finish the final leg (leg 36)
startNextRunner(35, 36);
```

## Future Considerations

1. **Type Safety**: Consider using TypeScript branded types for leg IDs vs runner IDs
2. **Validation**: Add runtime validation for leg sequence integrity
3. **Error Recovery**: Implement automatic recovery for invalid transitions
4. **Logging**: Add structured logging for better debugging

This fix ensures that the start runner functionality works correctly and provides clear, maintainable code that prevents parameter confusion in the future.
