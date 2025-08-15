// Diagnostic utilities to help identify dashboard data population issues

import { invokeEdge, getDeviceId } from '@/integrations/supabase/edge';

export interface DiagnosticInfo {
  device: {
    deviceId: string;
    teamId: string | null;
    role: string | null;
    name: string | null;
  };
  team: {
    id: string | null;
    name: string | null;
    loaded: boolean;
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
  team: any,
  deviceInfo: any,
  raceStore: any
): Promise<DiagnosticInfo> => {
  const deviceId = getDeviceId();
  
  const diagnostics: DiagnosticInfo = {
    device: {
      deviceId,
      teamId: deviceInfo?.teamId || null,
      role: deviceInfo?.role || null,
      name: deviceInfo?.displayName || null
    },
    team: {
      id: team?.id || null,
      name: team?.name || null,
      loaded: !!team
    },
    raceStore: {
      teamId: raceStore.teamId || null,
      isSetupComplete: raceStore.isSetupComplete || false,
      runnersCount: raceStore.runners?.length || 0,
      legsCount: raceStore.legs?.length || 0,
      hasNonDefaultData: hasNonDefaultRunnerData(raceStore.runners || []),
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

  // Check database data via Edge Functions if team exists
  if (team?.id) {
    try {
      const [runnersResult, legsResult] = await Promise.all([
        invokeEdge<{ runners: any[] }>('runners-list', { teamId: team.id, deviceId }),
        invokeEdge<{ legs: any[] }>('legs-list', { teamId: team.id, deviceId })
      ]);

      const runnersCount = !(runnersResult as any).error ? ((runnersResult as any).data?.runners?.length || 0) : 0;
      const legsCount = !(legsResult as any).error ? ((legsResult as any).data?.legs?.length || 0) : 0;

      diagnostics.database.runnersInDB = runnersCount;
      diagnostics.database.legsInDB = legsCount;
      diagnostics.database.dataExists = runnersCount > 0;
    } catch (error) {
      console.error('Error checking database via Edge Functions:', error);
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
  
  console.log('📱 Device State:', {
    deviceId: diagnostics.device.deviceId,
    teamId: diagnostics.device.teamId,
    role: diagnostics.device.role,
    name: diagnostics.device.name
  });

  console.log('👥 Team State:', {
    loaded: diagnostics.team.loaded,
    id: diagnostics.team.id,
    name: diagnostics.team.name
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
  
  if (!diagnostics.device.teamId) {
    console.error('❌ ISSUE: Device not associated with a team');
  }
  
  if (!diagnostics.team.loaded) {
    console.error('❌ ISSUE: Team not loaded');
  }
  
  if (!diagnostics.device.role) {
    console.error('❌ ISSUE: Device has no role assigned');
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
  team: any,
  deviceInfo: any,
  raceStore: any
) => {
  const diagnostics = await collectDiagnosticInfo(team, deviceInfo, raceStore);
  logDiagnostics(diagnostics);
  return diagnostics;
};
