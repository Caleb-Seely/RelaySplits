import { LEG_DISTANCES } from './legData';

import type { Runner, Leg } from '@/types/race';

// Helper function to convert pace from MM:SS format to seconds per mile
const paceToSeconds = (pace: string): number => {
  const [minutes, seconds] = pace.split(':').map(Number);
  return minutes * 60 + seconds;
};

// Helper function to shuffle array and assign random IDs
const shuffleAndAssignIds = <T extends { id: number }>(items: Omit<T, 'id'>[]): T[] => {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.map((item, index) => ({
    ...item,
    id: index + 1
  })) as T[];
};

// Demo runners with the new names and paces
const demoRunnersData = [
  { name: "Michael McMelon", pace: "10:15", van: 1 as const },
  { name: "Thor Thorson", pace: "5:20", van: 1 as const },
  { name: "Mo M.", pace: "4:45", van: 1 as const },
  { name: "Isaak Graff", pace: "6:50", van: 1 as const },
  { name: "Charlotte Quinn", pace: "7:00", van: 1 as const },
  { name: "Chris Runner", pace: "5:05", van: 1 as const },
  { name: "Diego Grace", pace: "6:15", van: 2 as const },
  { name: "George Murphy", pace: "8:30", van: 2 as const },
  { name: "Gus Harquil", pace: "9:45", van: 2 as const },
  { name: "Sam Howard", pace: "7:10", van: 2 as const },
  { name: "Oliver Quinn", pace: "5:55", van: 2 as const },
  { name: "Kian Lewis", pace: "6:30", van: 2 as const }
];

// Singleton to store the generated runners for this session
let demoRunnersInstance: Runner[] | null = null;

// Convert pace strings to seconds and create runners with random IDs
export const getDemoRunners = (): Runner[] => {
  // If we already have runners generated for this session, return them
  if (demoRunnersInstance) {
    return demoRunnersInstance;
  }

  // Generate new runners with random IDs
  const runnersWithPaces = demoRunnersData.map(runner => ({
    ...runner,
    pace: paceToSeconds(runner.pace),
    updated_at: null
  }));
  
  demoRunnersInstance = shuffleAndAssignIds(runnersWithPaces);
  return demoRunnersInstance;
};

// Function to reset the demo runners (useful for testing or new sessions)
export const resetDemoRunners = (): void => {
  demoRunnersInstance = null;
};

// Demo team data
export const demoTeam = {
  id: 'demo-team-id',
  name: 'Demo Team',
  join_code: 'DEMO12',
  start_time: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Get demo start time (current hour, on the hour)
export const getDemoStartTime = (): number => {
  const now = new Date();
  const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  return startTime.getTime();
};

// Calculate projected finish time for a leg
const calculateProjectedFinish = (leg: Leg, runner: Runner): number => {
  const startTime = leg.actualStart || leg.projectedStart;
  return startTime + (runner.pace * leg.distance * 1000); // Convert to milliseconds
};

// Recalculate projected times for all legs based on actual times
const recalculateProjectedTimes = (legs: Leg[]): Leg[] => {
  const runners = getDemoRunners();
  
  return legs.map((leg, index) => {
    const runner = runners.find(r => r.id === leg.runnerId);
    if (!runner) return leg;

    // If this leg has an actual start time, recalculate its projected finish
    if (leg.actualStart) {
      leg.projectedFinish = calculateProjectedFinish(leg, runner);
    }

    // Update projected start time for next leg based on previous leg's finish
    if (index > 0) {
      const prevLeg = legs[index - 1];
      const prevRunner = runners.find(r => r.id === prevLeg.runnerId);
      
      if (prevRunner) {
        // Use actual finish time if available, otherwise use projected
        const prevFinishTime = prevLeg.actualFinish || prevLeg.projectedFinish;
        leg.projectedStart = prevFinishTime;
        
        // Recalculate projected finish for this leg
        leg.projectedFinish = calculateProjectedFinish(leg, runner);
      }
    }

    return leg;
  });
};

// Initialize demo legs with proper timing
export const initializeDemoLegs = (startTime: number): Leg[] => {
  const runners = getDemoRunners(); // Get runners once for this initialization
  let currentTime = startTime;
  
  const initialLegs: Leg[] = LEG_DISTANCES.map((distance, index) => {
    const legNumber = index + 1;
    const runnerIndex = index % 12;
    const runner = runners[runnerIndex];
    
    // Calculate projected finish time based on runner's pace
    const projectedFinish = currentTime + (runner.pace * distance * 1000); // Convert to milliseconds
    
    const leg: Leg = {
      id: legNumber,
      runnerId: runner.id,
      distance,
      projectedStart: currentTime,
      projectedFinish,
      updated_at: null
    };
    
    // Set leg 1's actual start time to the current hour
    if (legNumber === 1) {
      leg.actualStart = startTime;
    }
    
    currentTime = projectedFinish;
    return leg;
  });

  // Recalculate all projected times to ensure consistency
  return recalculateProjectedTimes(initialLegs);
};

// Update leg with actual start/finish time and recalculate subsequent projections
export const updateDemoLeg = (legs: Leg[], legId: number, field: 'actualStart' | 'actualFinish', timestamp: number): Leg[] => {
  const updatedLegs = legs.map(leg => 
    leg.id === legId 
      ? { ...leg, [field]: timestamp }
      : leg
  );

  // Recalculate projected times after the update
  return recalculateProjectedTimes(updatedLegs);
};
