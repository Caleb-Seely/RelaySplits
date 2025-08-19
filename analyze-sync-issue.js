// Focused analysis script to identify start/finish time erasure issues
// This script will examine the specific code paths that could cause data loss

// Analysis functions to examine specific code paths
const analysisFunctions = {
  // Analyze the merge function in useEnhancedSyncManager
  analyzeMergeFunction() {
    console.log('\n=== Analysis: Merge Function in useEnhancedSyncManager ===');
    
    const mergeCode = `
    // From useEnhancedSyncManager.ts lines 625-680
    const mergeWithConflictDetection = useCallback((
      incomingItems: any[],
      localItems: any[],
      updateAction: (items: any[]) => void,
      table: 'runners' | 'legs'
    ) => {
      const localItemsMap = new Map(localItems.map((item) => [item.id, item]));
      const mergedItems = [...localItems];

      for (const incomingItem of incomingItems) {
        const localItem = localItemsMap.get(incomingItem.id);

        // If the item doesn't exist locally, or if the incoming item is newer, we update it.
        if (!localItem || !localItem.updated_at || new Date(incomingItem.updated_at!) > new Date(localItem.updated_at)) {
          const existingIndex = mergedItems.findIndex(item => item.id === incomingItem.id);
          if (existingIndex !== -1) {
            mergedItems[existingIndex] = incomingItem; // ⚠️ POTENTIAL ISSUE: Complete replacement
          } else {
            mergedItems.push(incomingItem);
          }
        }
      }
    });
    `;
    
    console.log('🔍 ISSUE IDENTIFIED:');
    console.log('The merge function completely replaces local items with incoming items when the incoming item is newer.');
    console.log('This means if the server has a leg with only start_time but no finish_time, and the local leg has both,');
    console.log('the local finish_time will be lost when the server data is newer.');
    console.log('');
    console.log('Code location: useEnhancedSyncManager.ts, line ~650');
    console.log('Problem: mergedItems[existingIndex] = incomingItem; // Complete replacement');
    
    return {
      issue: 'Complete item replacement in merge function',
      severity: 'HIGH',
      location: 'useEnhancedSyncManager.ts:650',
      description: 'When server data is newer, the entire local item is replaced, potentially losing fields that exist locally but not on server'
    };
  },

  // Analyze the legs-upsert function
  analyzeLegsUpsertFunction() {
    console.log('\n=== Analysis: Legs Upsert Function ===');
    
    const upsertCode = `
    // From legs-upsert/index.ts lines 100-150
    // 2) Handle partial updates per row (requires id)
    for (const row of partialRows) {
      if (!row?.id) {
        console.error('Partial leg update missing id:', row)
        return new Response(
          JSON.stringify({ error: 'Partial leg update requires id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const updatePayload = {
        ...row,
        team_id: teamId,
        updated_at: new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('legs')
        .update(updatePayload)
        .eq('team_id', teamId)
        .eq('id', row.id)
    }
    `;
    
    console.log('🔍 POTENTIAL ISSUE:');
    console.log('The legs-upsert function uses partial updates, which should preserve existing fields.');
    console.log('However, if the client sends incomplete data, fields might be lost.');
    console.log('');
    console.log('Code location: legs-upsert/index.ts, line ~120');
    console.log('The updatePayload spreads the row data, which should preserve existing fields.');
    
    return {
      issue: 'Partial updates should preserve existing fields',
      severity: 'LOW',
      location: 'legs-upsert/index.ts:120',
      description: 'The upsert function appears to handle partial updates correctly by spreading the row data'
    };
  },

  // Analyze the sync payload construction
  analyzeSyncPayloadConstruction() {
    console.log('\n=== Analysis: Sync Payload Construction ===');
    
    const payloadCode = `
    // From useEnhancedSyncManager.ts lines 80-100
    const payload = {
      id: leg.remoteId,
      number: leg.id,
      distance: leg.distance,
      [field === 'actualStart' ? 'start_time' : 'finish_time']: value ? new Date(value).toISOString() : null
    };
    `;
    
    console.log('🔍 ISSUE IDENTIFIED:');
    console.log('The sync payload only includes the specific field being updated (start_time OR finish_time).');
    console.log('This means when syncing a start time, the finish_time is not included in the payload.');
    console.log('If the server processes this as a complete replacement rather than a partial update,');
    console.log('the finish_time could be lost.');
    console.log('');
    console.log('Code location: useEnhancedSyncManager.ts:80-100');
    console.log('Problem: Payload only includes one timing field at a time');
    
    return {
      issue: 'Incomplete payload in sync operations',
      severity: 'HIGH',
      location: 'useEnhancedSyncManager.ts:80-100',
      description: 'Sync payloads only include the specific field being updated, not all leg data'
    };
  },

  // Analyze the recalculateProjections function
  analyzeProjectionRecalculation() {
    console.log('\n=== Analysis: Projection Recalculation ===');
    
    const projectionCode = `
    // From raceUtils.ts lines 149-200
    export function recalculateProjections(legs: Leg[], updatedIndex: number, runners: Runner[], raceStartTime?: number): Leg[] {
      const updatedLegs = [...legs];
      
      for (let i = Math.max(0, updatedIndex); i < updatedLegs.length; i++) {
        const currentLeg = updatedLegs[i];
        const runner = runners.find(r => r.id === currentLeg.runnerId);
        
        if (!runner) continue;
        
        // For the first leg, it should start exactly at race start time
        if (i === 0) {
          const startTime = currentLeg.actualStart || raceStartTime || currentLeg.projectedStart;
          updatedLegs[i] = {
            ...currentLeg,
            projectedStart: startTime,
            projectedFinish: calculateProjectedFinish(startTime, currentLeg.paceOverride ?? runner.pace, currentLeg.distance)
          };
        } else {
          // ... more logic
        }
      }
      
      return updatedLegs;
    }
    `;
    
    console.log('🔍 POTENTIAL ISSUE:');
    console.log('The recalculateProjections function spreads the currentLeg and then updates specific fields.');
    console.log('This should preserve all existing fields including actualStart and actualFinish.');
    console.log('However, if the function is called with incomplete leg data, fields might be lost.');
    console.log('');
    console.log('Code location: raceUtils.ts:149-200');
    console.log('The function uses spread operator which should preserve existing fields.');
    
    return {
      issue: 'Projection recalculation should preserve actual times',
      severity: 'MEDIUM',
      location: 'raceUtils.ts:149-200',
      description: 'The function uses spread operator which should preserve existing fields, but depends on input data completeness'
    };
  },

  // Analyze the event bus processing
  analyzeEventBusProcessing() {
    console.log('\n=== Analysis: Event Bus Processing ===');
    
    const eventBusCode = `
    // From eventBus.ts lines 40-80
    private async processEvents(): Promise<void> {
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
        // Process high priority events first
        while (this.highPriorityQueue.length > 0) {
          const event = this.highPriorityQueue.shift()!;
          await this.processEvent(event);
        }
      } finally {
        this.isProcessing = false;
      }
    }
    `;
    
    console.log('🔍 POTENTIAL ISSUE:');
    console.log('The event bus processes events sequentially, which should maintain order.');
    console.log('However, if multiple devices are updating the same leg simultaneously,');
    console.log('the order of events might not reflect the actual timing of changes.');
    console.log('');
    console.log('Code location: eventBus.ts:40-80');
    console.log('Events are processed in order, but network delays could cause out-of-order processing.');
    
    return {
      issue: 'Event processing order vs network timing',
      severity: 'MEDIUM',
      location: 'eventBus.ts:40-80',
      description: 'Events are processed in order, but network delays could cause timing issues'
    };
  }
};

// Main analysis function
function runAnalysis() {
  console.log('🔍 Starting Sync Issue Analysis...\n');
  
  const issues = [];
  
  for (const [analysisName, analysisFn] of Object.entries(analysisFunctions)) {
    console.log(`📋 Running ${analysisName}...`);
    const result = analysisFn();
    issues.push(result);
  }
  
  console.log('\n📊 Analysis Summary:');
  console.log('===================');
  
  const highSeverityIssues = issues.filter(issue => issue.severity === 'HIGH');
  const mediumSeverityIssues = issues.filter(issue => issue.severity === 'MEDIUM');
  const lowSeverityIssues = issues.filter(issue => issue.severity === 'LOW');
  
  console.log(`🔴 High Severity Issues: ${highSeverityIssues.length}`);
  highSeverityIssues.forEach(issue => {
    console.log(`  - ${issue.issue} (${issue.location})`);
    console.log(`    ${issue.description}`);
  });
  
  console.log(`🟡 Medium Severity Issues: ${mediumSeverityIssues.length}`);
  mediumSeverityIssues.forEach(issue => {
    console.log(`  - ${issue.issue} (${issue.location})`);
    console.log(`    ${issue.description}`);
  });
  
  console.log(`🟢 Low Severity Issues: ${lowSeverityIssues.length}`);
  lowSeverityIssues.forEach(issue => {
    console.log(`  - ${issue.issue} (${issue.location})`);
    console.log(`    ${issue.description}`);
  });
  
  console.log('\n🎯 Root Cause Analysis:');
  console.log('======================');
  
  if (highSeverityIssues.length > 0) {
    console.log('The most likely cause of start/finish time erasure is:');
    console.log('');
    console.log('1. INCOMPLETE SYNC PAYLOADS: The sync system only sends the specific field being updated');
    console.log('   rather than the complete leg data. This could cause the server to overwrite existing fields.');
    console.log('');
    console.log('2. COMPLETE ITEM REPLACEMENT: The merge function completely replaces local items with');
    console.log('   server items when the server data is newer, potentially losing local-only fields.');
    console.log('');
    console.log('3. RACE CONDITIONS: Multiple devices updating the same leg simultaneously could cause');
    console.log('   data to be overwritten if the sync timing is not properly coordinated.');
  }
  
  console.log('\n💡 Recommended Solutions:');
  console.log('========================');
  console.log('1. Modify sync payloads to include all leg data, not just the changed field');
  console.log('2. Implement field-level merging instead of complete item replacement');
  console.log('3. Add optimistic locking or versioning to prevent race conditions');
  console.log('4. Implement data validation before and after sync operations');
  console.log('5. Add comprehensive logging to track data changes during sync');
  
  return issues;
}

// Run analysis if this file is executed directly
runAnalysis();

export { analysisFunctions, runAnalysis };
