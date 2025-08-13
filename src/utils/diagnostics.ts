// Diagnostic utilities to help identify dashboard data population issues

export interface DiagnosticInfo {
  user: {
    id: string | null;
    email: string | null;
    authenticated: boolean;
  };
  team: {
    id: string | null;
    name: string | null;
    loaded: boolean;
  };
  teamMember: {
    userId: string | null;
    teamId: string | null;
    role: string | null;
    exists: boolean;
  };
  raceStore: {
    teamId: string | null;
    isSetupComplete: boolean;
    runnersCount: number;
    legsCount: number;
    hasNonDefaultData: boolean;
    hasOfflineData: boolean;
  };
  database: {
    runnersInDB: number;
    legsInDB: number;
    dataExists: boolean;
  };
  sync: {
    isOnline: boolean;
    hasOfflineChanges: boolean;
    lastSyncAttempt: number | null;
  };
}

export const collectDiagnosticInfo = async (
  user: any,
  team: any,
  teamMember: any,
  raceStore: any,
  supabase: any
): Promise<DiagnosticInfo> => {
  const diagnostics: DiagnosticInfo = {
    user: {
      id: user?.id || null,
      email: user?.email || null,
      authenticated: !!user
    },
    team: {
      id: team?.id || null,
      name: team?.name || null,
      loaded: !!team
    },
    teamMember: {
      userId: teamMember?.user_id || null,
      teamId: teamMember?.team_id || null,
      role: teamMember?.role || null,
      exists: !!teamMember
    },
    raceStore: {
      teamId: raceStore.teamId || null,
      isSetupComplete: raceStore.isSetupComplete,
      runnersCount: raceStore.runners?.length || 0,
      legsCount: raceStore.legs?.length || 0,
      hasNonDefaultData: hasNonDefaultRunnerData(raceStore.runners),
      hasOfflineData: raceStore.hasOfflineData ? raceStore.hasOfflineData() : false
    },
    database: {
      runnersInDB: 0,
      legsInDB: 0,
      dataExists: false
    },
    sync: {
      isOnline: navigator.onLine,
      hasOfflineChanges: false,
      lastSyncAttempt: null
    }
  };

  // Check database data if team exists
  if (team?.id) {
    try {
      const [runnersResult, legsResult] = await Promise.all([
        supabase.from('runners').select('*', { count: 'exact' }).eq('team_id', team.id),
        supabase.from('legs').select('*', { count: 'exact' }).eq('team_id', team.id)
      ]);

      diagnostics.database.runnersInDB = runnersResult.count || 0;
      diagnostics.database.legsInDB = legsResult.count || 0;
      diagnostics.database.dataExists = (runnersResult.count || 0) > 0;
    } catch (error) {
      console.error('Error checking database:', error);
    }

    // Check for offline changes
    try {
      const offlineChangesKey = `relay_tracker_${team.id}_offline_changes`;
      const offlineChanges = localStorage.getItem(offlineChangesKey);
      diagnostics.sync.hasOfflineChanges = !!(offlineChanges && JSON.parse(offlineChanges).length > 0);
    } catch (error) {
      console.warn('Error checking offline changes:', error);
    }
  }

  return diagnostics;
};

const hasNonDefaultRunnerData = (runners: any[]): boolean => {
  if (!runners || runners.length === 0) return false;
  
  return runners.some(runner => 
    !runner.name.startsWith('Runner ') || 
    runner.pace !== 420
  );
};

export const logDiagnostics = (diagnostics: DiagnosticInfo) => {
  console.group('🔍 DASHBOARD BUG DIAGNOSTICS');
  
  console.log('👤 User State:', {
    authenticated: diagnostics.user.authenticated,
    id: diagnostics.user.id,
    email: diagnostics.user.email
  });

  console.log('👥 Team State:', {
    loaded: diagnostics.team.loaded,
    id: diagnostics.team.id,
    name: diagnostics.team.name
  });

  console.log('🤝 Team Membership:', {
    exists: diagnostics.teamMember.exists,
    userId: diagnostics.teamMember.userId,
    teamId: diagnostics.teamMember.teamId,
    role: diagnostics.teamMember.role
  });

  console.log('🏪 Race Store State:', {
    teamId: diagnostics.raceStore.teamId,
    setupComplete: diagnostics.raceStore.isSetupComplete,
    runners: diagnostics.raceStore.runnersCount,
    legs: diagnostics.raceStore.legsCount,
    hasCustomData: diagnostics.raceStore.hasNonDefaultData,
    hasOfflineData: diagnostics.raceStore.hasOfflineData
  });

  console.log('💾 Database State:', {
    dataExists: diagnostics.database.dataExists,
    runners: diagnostics.database.runnersInDB,
    legs: diagnostics.database.legsInDB
  });

  console.log('📡 Sync State:', {
    isOnline: diagnostics.sync.isOnline,
    hasOfflineChanges: diagnostics.sync.hasOfflineChanges,
    lastSyncAttempt: diagnostics.sync.lastSyncAttempt
  });

  // Analysis
  console.group('🔎 Issue Analysis');
  
  if (!diagnostics.user.authenticated) {
    console.error('❌ ISSUE: User not authenticated');
  }
  
  if (!diagnostics.team.loaded) {
    console.error('❌ ISSUE: Team not loaded');
  }
  
  if (!diagnostics.teamMember.exists) {
    console.error('❌ ISSUE: User not a team member');
  }
  
  if (diagnostics.team.id !== diagnostics.raceStore.teamId) {
    console.error('❌ ISSUE: Team ID mismatch between team and race store', {
      teamId: diagnostics.team.id,
      raceStoreTeamId: diagnostics.raceStore.teamId
    });
  }
  
  if (diagnostics.database.dataExists && !diagnostics.raceStore.isSetupComplete) {
    console.error('❌ ISSUE: Data exists in database but setup not marked complete');
    console.info('💡 This usually indicates a race condition during data synchronization. The app should resolve this automatically.');
  }
  
  if (diagnostics.database.dataExists && !diagnostics.raceStore.hasNonDefaultData) {
    console.error('❌ ISSUE: Data exists in database but race store has default data');
    console.info('💡 This suggests the local store hasn\'t been updated with database data yet. This should resolve automatically.');
  }
  
  if (!diagnostics.database.dataExists && diagnostics.raceStore.isSetupComplete) {
    console.warn('⚠️ WARNING: Setup marked complete but no data in database');
    console.info('💡 This might indicate offline data that hasn\'t been synced yet.');
  }

  if (!diagnostics.sync.isOnline) {
    console.warn('⚠️ WARNING: App is currently offline');
    console.info('💡 Data changes will be queued and synced when connection is restored.');
  }

  if (diagnostics.sync.hasOfflineChanges) {
    console.info('ℹ️ INFO: Offline changes detected and will be synced when online');
  }

  if (diagnostics.raceStore.hasOfflineData && !diagnostics.database.dataExists) {
    console.info('ℹ️ INFO: Offline data available but not yet synced to database');
  }

  console.groupEnd();
  console.groupEnd();
};

export const runDiagnostics = async (
  user: any,
  team: any,
  teamMember: any,
  raceStore: any,
  supabase: any
) => {
  const diagnostics = await collectDiagnosticInfo(user, team, teamMember, raceStore, supabase);
  logDiagnostics(diagnostics);
  return diagnostics;
};
