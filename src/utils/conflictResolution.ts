import type { Leg, Runner } from '@/types/race';

/**
 * Represents a data conflict between local and server versions
 */
export interface DataConflict {
  type: 'leg' | 'runner';
  id: number;
  localData: unknown;
  serverData: unknown;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

/**
 * Conflict resolution strategy
 */
export type ConflictStrategy = 'local' | 'server' | 'merge' | 'manual' | 'newest' | 'oldest';

/**
 * Conflict resolution result
 */
export interface ConflictResolutionResult {
  resolvedData: unknown;
  strategy: ConflictStrategy;
  conflicts: DataConflict[];
  timestamp: number;
}

/**
 * Detects conflicts between local and server data
 */
export const detectConflicts = (
  localData: { legs: Leg[]; runners: Runner[] },
  serverData: { legs: Leg[]; runners: Runner[] }
): DataConflict[] => {
  const conflicts: DataConflict[] = [];
  
  // Check for leg conflicts
  for (const localLeg of localData.legs) {
    const serverLeg = serverData.legs.find(l => l.id === localLeg.id);
    if (serverLeg && JSON.stringify(localLeg) !== JSON.stringify(serverLeg)) {
      const severity = determineConflictSeverity(localLeg, serverLeg, 'leg');
      conflicts.push({
        type: 'leg',
        id: localLeg.id,
        localData: localLeg,
        serverData: serverLeg,
        timestamp: Date.now(),
        severity,
        description: generateConflictDescription(localLeg, serverLeg, 'leg')
      });
    }
  }
  
  // Check for runner conflicts
  for (const localRunner of localData.runners) {
    const serverRunner = serverData.runners.find(r => r.id === localRunner.id);
    if (serverRunner && JSON.stringify(localRunner) !== JSON.stringify(serverRunner)) {
      const severity = determineConflictSeverity(localRunner, serverRunner, 'runner');
      conflicts.push({
        type: 'runner',
        id: localRunner.id,
        localData: localRunner,
        serverData: serverRunner,
        timestamp: Date.now(),
        severity,
        description: generateConflictDescription(localRunner, serverRunner, 'runner')
      });
    }
  }
  
  return conflicts;
};

/**
 * Determines the severity of a conflict based on the data differences
 */
const determineConflictSeverity = (
  local: unknown, 
  server: unknown, 
  type: 'leg' | 'runner'
): 'low' | 'medium' | 'high' => {
  if (type === 'leg') {
    const localLeg = local as Leg;
    const serverLeg = server as Leg;
    
    // High severity: actual timing data conflicts
    if (localLeg.actualStart !== serverLeg.actualStart || 
        localLeg.actualFinish !== serverLeg.actualFinish) {
      return 'high';
    }
    
    // Medium severity: projected timing conflicts
    if (localLeg.projectedStart !== serverLeg.projectedStart || 
        localLeg.projectedFinish !== serverLeg.projectedFinish) {
      return 'medium';
    }
    
    // Low severity: other field conflicts
    return 'low';
  } else {
    const localRunner = local as Runner;
    const serverRunner = server as Runner;
    
    // High severity: name conflicts
    if (localRunner.name !== serverRunner.name) {
      return 'high';
    }
    
    // Medium severity: pace conflicts
    if (localRunner.pace !== serverRunner.pace) {
      return 'medium';
    }
    
    // Low severity: other field conflicts
    return 'low';
  }
};

/**
 * Generates a human-readable description of the conflict
 */
const generateConflictDescription = (
  local: unknown, 
  server: unknown, 
  type: 'leg' | 'runner'
): string => {
  if (type === 'leg') {
    const localLeg = local as Leg;
    const serverLeg = server as Leg;
    
    if (localLeg.actualStart !== serverLeg.actualStart) {
      return `Actual start time conflict: ${new Date(localLeg.actualStart || 0).toLocaleString()} vs ${new Date(serverLeg.actualStart || 0).toLocaleString()}`;
    }
    
    if (localLeg.actualFinish !== serverLeg.actualFinish) {
      return `Actual finish time conflict: ${new Date(localLeg.actualFinish || 0).toLocaleString()} vs ${new Date(serverLeg.actualFinish || 0).toLocaleString()}`;
    }
    
    if (localLeg.distance !== serverLeg.distance) {
      return `Distance conflict: ${localLeg.distance} vs ${serverLeg.distance} miles`;
    }
    
    return 'Leg data conflict detected';
  } else {
    const localRunner = local as Runner;
    const serverRunner = server as Runner;
    
    if (localRunner.name !== serverRunner.name) {
      return `Name conflict: "${localRunner.name}" vs "${serverRunner.name}"`;
    }
    
    if (localRunner.pace !== serverRunner.pace) {
      return `Pace conflict: ${localRunner.pace} vs ${serverRunner.pace} seconds/mile`;
    }
    
    return 'Runner data conflict detected';
  }
};

/**
 * Resolves a conflict using the specified strategy
 */
export const resolveConflict = (
  conflict: DataConflict,
  strategy: ConflictStrategy = 'merge'
): unknown => {
  switch (strategy) {
    case 'local':
      return conflict.localData;
    case 'server':
      return conflict.serverData;
    case 'newest':
      return getNewestData(conflict.localData, conflict.serverData);
    case 'oldest':
      return getOldestData(conflict.localData, conflict.serverData);
    case 'merge':
      return mergeData(conflict.localData, conflict.serverData, conflict.type);
    case 'manual':
      // Return both for manual resolution
      return { local: conflict.localData, server: conflict.serverData };
    default:
      return conflict.localData;
  }
};

/**
 * Gets the newest data based on timestamps
 */
const getNewestData = (local: unknown, server: unknown): unknown => {
  const localTimestamp = getDataTimestamp(local);
  const serverTimestamp = getDataTimestamp(server);
  
  return localTimestamp > serverTimestamp ? local : server;
};

/**
 * Gets the oldest data based on timestamps
 */
const getOldestData = (local: unknown, server: unknown): unknown => {
  const localTimestamp = getDataTimestamp(local);
  const serverTimestamp = getDataTimestamp(server);
  
  return localTimestamp < serverTimestamp ? local : server;
};

/**
 * Extracts timestamp from data object
 */
const getDataTimestamp = (data: unknown): number => {
  if (data && typeof data === 'object' && 'updated_at' in data) {
    const updatedAt = (data as any).updated_at;
    if (typeof updatedAt === 'string') {
      return new Date(updatedAt).getTime();
    }
  }
  return 0;
};

/**
 * Merges data based on type and field importance
 */
const mergeData = (local: unknown, server: unknown, type: 'leg' | 'runner'): unknown => {
  if (type === 'leg') {
    return mergeLegData(local as Leg, server as Leg);
  } else {
    return mergeRunnerData(local as Runner, server as Runner);
  }
};

/**
 * Merges leg data with smart field selection
 */
const mergeLegData = (local: Leg, server: Leg): Leg => {
  return {
    ...local,
    // Prefer actual timing data (more important)
    actualStart: local.actualStart || server.actualStart,
    actualFinish: local.actualFinish || server.actualFinish,
    // Prefer local projected times (user's planning)
    projectedStart: local.projectedStart,
    projectedFinish: local.projectedFinish,
    // Prefer local distance (user's planning)
    distance: local.distance,
    // Prefer local pace override (user's planning)
    paceOverride: local.paceOverride,
    // Use newest timestamp
    updated_at: getNewestTimestamp(local.updated_at, server.updated_at)
  };
};

/**
 * Merges runner data with smart field selection
 */
const mergeRunnerData = (local: Runner, server: Runner): Runner => {
  return {
    ...local,
    // Prefer local name (user's preference)
    name: local.name,
    // Prefer local pace (user's input)
    pace: local.pace,
    // Prefer local van assignment (user's planning)
    van: local.van,
    // Use newest timestamp
    updated_at: getNewestTimestamp(local.updated_at, server.updated_at)
  };
};

/**
 * Gets the newest timestamp from two timestamp strings
 */
const getNewestTimestamp = (local: string | null, server: string | null): string | null => {
  if (!local) return server;
  if (!server) return local;
  
  const localTime = new Date(local).getTime();
  const serverTime = new Date(server).getTime();
  
  return localTime > serverTime ? local : server;
};

/**
 * Resolves multiple conflicts using a strategy
 */
export const resolveConflicts = (
  conflicts: DataConflict[],
  strategy: ConflictStrategy = 'merge'
): ConflictResolutionResult => {
  const resolvedData: Record<string, unknown> = {};
  
  for (const conflict of conflicts) {
    const key = `${conflict.type}_${conflict.id}`;
    resolvedData[key] = resolveConflict(conflict, strategy);
  }
  
  return {
    resolvedData,
    strategy,
    conflicts,
    timestamp: Date.now()
  };
};

/**
 * Auto-resolves conflicts based on severity and type
 */
export const autoResolveConflicts = (conflicts: DataConflict[]): ConflictResolutionResult => {
  const resolvedData: Record<string, unknown> = {};
  
  for (const conflict of conflicts) {
    let strategy: ConflictStrategy = 'merge';
    
    // Auto-resolve based on severity and type
    if (conflict.severity === 'high') {
      if (conflict.type === 'leg') {
        // For high-severity leg conflicts, prefer server data for actual times
        strategy = 'server';
      } else {
        // For high-severity runner conflicts, prefer local data for names
        strategy = 'local';
      }
    } else if (conflict.severity === 'medium') {
      // For medium severity, use merge strategy
      strategy = 'merge';
    } else {
      // For low severity, prefer local data
      strategy = 'local';
    }
    
    const key = `${conflict.type}_${conflict.id}`;
    resolvedData[key] = resolveConflict(conflict, strategy);
  }
  
  return {
    resolvedData,
    strategy: 'auto',
    conflicts,
    timestamp: Date.now()
  };
};

/**
 * Creates a conflict resolution report
 */
export const createConflictReport = (conflicts: DataConflict[]): string => {
  if (conflicts.length === 0) {
    return '✅ No conflicts detected';
  }
  
  let report = `⚠️  Found ${conflicts.length} conflicts:\n\n`;
  
  const bySeverity = {
    high: conflicts.filter(c => c.severity === 'high'),
    medium: conflicts.filter(c => c.severity === 'medium'),
    low: conflicts.filter(c => c.severity === 'low')
  };
  
  if (bySeverity.high.length > 0) {
    report += `🔴 High Severity (${bySeverity.high.length}):\n`;
    bySeverity.high.forEach(conflict => {
      report += `  • ${conflict.type} ${conflict.id}: ${conflict.description}\n`;
    });
    report += '\n';
  }
  
  if (bySeverity.medium.length > 0) {
    report += `🟡 Medium Severity (${bySeverity.medium.length}):\n`;
    bySeverity.medium.forEach(conflict => {
      report += `  • ${conflict.type} ${conflict.id}: ${conflict.description}\n`;
    });
    report += '\n';
  }
  
  if (bySeverity.low.length > 0) {
    report += `🟢 Low Severity (${bySeverity.low.length}):\n`;
    bySeverity.low.forEach(conflict => {
      report += `  • ${conflict.type} ${conflict.id}: ${conflict.description}\n`;
    });
    report += '\n';
  }
  
  return report;
};
