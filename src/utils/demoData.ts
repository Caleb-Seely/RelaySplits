import type { Runner, Leg } from '@/types/race';
import { LEG_DISTANCES } from './legData';

// Demo runners with realistic names and paces
export const demoRunners: Runner[] = [
  { id: 1, name: "Sarah Johnson", pace: 420, van: 1, updated_at: null }, // 7:00 pace
  { id: 2, name: "Mike Chen", pace: 390, van: 1, updated_at: null },     // 6:30 pace
  { id: 3, name: "Emma Rodriguez", pace: 450, van: 1, updated_at: null }, // 7:30 pace
  { id: 4, name: "David Kim", pace: 360, van: 1, updated_at: null },     // 6:00 pace
  { id: 5, name: "Lisa Thompson", pace: 480, van: 1, updated_at: null }, // 8:00 pace
  { id: 6, name: "Alex Martinez", pace: 330, van: 1, updated_at: null }, // 5:30 pace
  { id: 7, name: "Rachel Green", pace: 420, van: 2, updated_at: null },  // 7:00 pace
  { id: 8, name: "Chris Wilson", pace: 390, van: 2, updated_at: null },  // 6:30 pace
  { id: 9, name: "Maria Garcia", pace: 450, van: 2, updated_at: null },  // 7:30 pace
  { id: 10, name: "James Brown", pace: 360, van: 2, updated_at: null },  // 6:00 pace
  { id: 11, name: "Amanda Lee", pace: 480, van: 2, updated_at: null },   // 8:00 pace
  { id: 12, name: "Tom Anderson", pace: 330, van: 2, updated_at: null }  // 5:30 pace
];

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
  return legs.map((leg, index) => {
    const runner = demoRunners.find(r => r.id === leg.runnerId);
    if (!runner) return leg;

    // If this leg has an actual start time, recalculate its projected finish
    if (leg.actualStart) {
      leg.projectedFinish = calculateProjectedFinish(leg, runner);
    }

    // Update projected start time for next leg based on previous leg's finish
    if (index > 0) {
      const prevLeg = legs[index - 1];
      const prevRunner = demoRunners.find(r => r.id === prevLeg.runnerId);
      
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
  let currentTime = startTime;
  
  const initialLegs: Leg[] = LEG_DISTANCES.map((distance, index) => {
    const legNumber = index + 1;
    const runnerIndex = index % 12;
    const runner = demoRunners[runnerIndex];
    
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
