import { describe, it, expect, beforeEach } from 'vitest';
import {
  parsePace,
  formatPace,
  formatTime,
  formatRaceTime,
  formatDuration,
  formatCountdown,
  calculateProjectedFinish,
  calculateCurrentDistance,
  calculateActualPace,
  getCurrentRunner,
  getNextRunner,
  getLegStatus,
  getRunnersByVan,
  getRunTime,
  getEffectiveStartTime,
  calculateTotalDistanceTraveled,
  initializeRace
} from '../utils/raceUtils';
import type { Runner, Leg } from '../types/race';

describe('Race Utilities', () => {
  let mockRunners: Runner[];
  let mockLegs: Leg[];

  beforeEach(() => {
    mockRunners = [
      { id: 1, name: 'Runner 1', pace: 420, van: 1 },
      { id: 2, name: 'Runner 2', pace: 450, van: 1 },
      { id: 3, name: 'Runner 3', pace: 480, van: 2 },
    ];

    mockLegs = [
      {
        id: 1,
        runnerId: 1,
        distance: 5.2,
        projectedStart: 1000000000000,
        projectedFinish: 1000000218400,
        actualStart: 1000000000000,
        actualFinish: null,
        status: 'running'
      },
      {
        id: 2,
        runnerId: 2,
        distance: 4.8,
        projectedStart: 1000000218400,
        projectedFinish: 1000000416800,
        actualStart: null,
        actualFinish: null,
        status: 'ready'
      },
      {
        id: 3,
        runnerId: 3,
        distance: 6.1,
        projectedStart: 1000000416800,
        projectedFinish: 1000000669000,
        actualStart: null,
        actualFinish: null,
        status: 'ready'
      }
    ];
  });

  describe('parsePace', () => {
    it('should parse MM:SS format correctly', () => {
      expect(parsePace('7:30')).toBe(450);
      expect(parsePace('8:45')).toBe(525);
      expect(parsePace('6:00')).toBe(360);
    });

    it('should parse minutes only format', () => {
      expect(parsePace('7')).toBe(420);
      expect(parsePace('10')).toBe(600);
    });

    it('should throw error for invalid format', () => {
      expect(() => parsePace('invalid')).toThrow('Invalid pace format');
      expect(() => parsePace('7:60')).toThrow('Invalid pace format');
      expect(() => parsePace('-5:30')).toThrow('Invalid pace format');
    });
  });

  describe('formatPace', () => {
    it('should format seconds to MM:SS', () => {
      expect(formatPace(450)).toBe('7:30');
      expect(formatPace(525)).toBe('8:45');
      expect(formatPace(360)).toBe('6:00');
    });

    it('should handle edge cases', () => {
      expect(formatPace(0)).toBe('0:00');
      expect(formatPace(59)).toBe('0:59');
      expect(formatPace(60)).toBe('1:00');
    });
  });

  describe('formatTime', () => {
    it('should format timestamp with seconds', () => {
      const timestamp = new Date('2025-08-22T13:30:45').getTime();
      expect(formatTime(timestamp)).toMatch(/1:30:45/);
    });
  });

  describe('formatRaceTime', () => {
    it('should format timestamp without seconds', () => {
      const timestamp = new Date('2025-08-22T13:30:45').getTime();
      expect(formatRaceTime(timestamp)).toMatch(/1:30/);
    });
  });

  describe('formatDuration', () => {
    it('should format duration correctly', () => {
      expect(formatDuration(3661000)).toBe('1:01:01'); // 1 hour, 1 minute, 1 second
      expect(formatDuration(61000)).toBe('1:01'); // 1 minute, 1 second
      expect(formatDuration(5000)).toBe('0:05'); // 5 seconds
    });
  });

  describe('formatCountdown', () => {
    it('should format countdown correctly', () => {
      expect(formatCountdown(3661000)).toBe('1h 1m');
      expect(formatCountdown(61000)).toBe('1m');
      expect(formatCountdown(5000)).toBe('5s');
      expect(formatCountdown(0)).toBe('now');
    });
  });

  describe('calculateProjectedFinish', () => {
    it('should calculate finish time correctly', () => {
      const startTime = 1000000000000; // Aug 22, 2025 1:00 PM
      const pace = 420; // 7:00 pace
      const distance = 5.2;
      
      const finishTime = calculateProjectedFinish(startTime, pace, distance);
      const expectedFinishTime = startTime + (pace * distance * 1000);
      
      expect(finishTime).toBe(expectedFinishTime);
    });
  });

  describe('calculateCurrentDistance', () => {
    it('should calculate remaining distance for running leg', () => {
      const leg = mockLegs[0];
      const runner = mockRunners[0];
      const currentTime = leg.actualStart! + (2 * 60 * 1000); // 2 minutes after start
      
      const remainingDistance = calculateCurrentDistance(leg, runner, currentTime);
      
      expect(remainingDistance).toBeGreaterThan(0);
      expect(remainingDistance).toBeLessThan(leg.distance);
    });

    it('should return 0 for finished leg', () => {
      const leg = { ...mockLegs[0], actualFinish: 1000000218400 };
      const runner = mockRunners[0];
      const currentTime = Date.now();
      
      const remainingDistance = calculateCurrentDistance(leg, runner, currentTime);
      expect(remainingDistance).toBe(0);
    });
  });

  describe('calculateActualPace', () => {
    it('should calculate actual pace correctly', () => {
      const leg = {
        ...mockLegs[0],
        actualFinish: 1000000218400 // 218400ms = 3.64 minutes after start
      };
      
      const actualPace = calculateActualPace(leg);
      expect(actualPace).toBeCloseTo(0.7, 2); // 0.7 minutes per mile (3.64 minutes / 5.2 miles)
    });

    it('should return null for incomplete leg', () => {
      const leg = mockLegs[0]; // No finish time
      const actualPace = calculateActualPace(leg);
      expect(actualPace).toBeNull();
    });
  });

  describe('getCurrentRunner', () => {
    it('should return currently running leg', () => {
      const now = new Date('2025-08-22T13:31:00');
      const currentRunner = getCurrentRunner(mockLegs, now);
      
      expect(currentRunner).toBe(mockLegs[0]);
    });

    it('should return null when no one is running', () => {
      const legs = mockLegs.map(leg => ({ ...leg, actualStart: null }));
      const now = new Date('2025-08-22T13:31:00');
      const currentRunner = getCurrentRunner(legs, now);
      
      expect(currentRunner).toBeNull();
    });
  });

  describe('getNextRunner', () => {
    it('should return next runner to start', () => {
      const now = new Date('2025-08-22T13:31:00');
      const nextRunner = getNextRunner(mockLegs, now);
      
      expect(nextRunner).toBe(mockLegs[1]);
    });

    it('should return null when all legs have started', () => {
      const legs = mockLegs.map(leg => ({ ...leg, actualStart: 1000000000000 }));
      const now = new Date('2025-08-22T13:31:00');
      const nextRunner = getNextRunner(legs, now);
      
      expect(nextRunner).toBeNull();
    });
  });

  describe('getLegStatus', () => {
    it('should return correct status for running leg', () => {
      const now = new Date('2025-08-22T13:31:00');
      const status = getLegStatus(mockLegs[0], now);
      expect(status).toBe('running');
    });

    it('should return correct status for finished leg', () => {
      const leg = { ...mockLegs[0], actualFinish: 1000000218400 };
      const now = new Date('2025-08-22T13:31:00');
      const status = getLegStatus(leg, now);
      expect(status).toBe('finished');
    });

    it('should return correct status for ready leg', () => {
      const now = new Date('2025-08-22T13:31:00');
      const status = getLegStatus(mockLegs[1], now);
      expect(status).toBe('ready');
    });
  });

  describe('getRunnersByVan', () => {
    it('should return runners for van 1', () => {
      const van1Runners = getRunnersByVan(mockRunners, 1);
      expect(van1Runners).toHaveLength(2);
      expect(van1Runners.every(r => r.van === 1)).toBe(true);
    });

    it('should return runners for van 2', () => {
      const van2Runners = getRunnersByVan(mockRunners, 2);
      expect(van2Runners).toHaveLength(1);
      expect(van2Runners.every(r => r.van === 2)).toBe(true);
    });
  });

  describe('getRunTime', () => {
    it('should calculate run time correctly', () => {
      const leg = {
        ...mockLegs[0],
        actualFinish: 1000000218400
      };
      
      const runTime = getRunTime(leg);
      expect(runTime).toBe(218400); // 3 minutes 38.4 seconds
    });

    it('should return null for incomplete leg', () => {
      const runTime = getRunTime(mockLegs[0]);
      expect(runTime).toBeNull();
    });
  });

  describe('getEffectiveStartTime', () => {
    it('should return actual start time if available', () => {
      const effectiveStart = getEffectiveStartTime(mockLegs[0], mockLegs, 1000000000000);
      expect(effectiveStart).toBe(mockLegs[0].actualStart);
    });

    it('should use previous leg finish time', () => {
      const leg = mockLegs[1];
      const legsWithFinish = [
        { ...mockLegs[0], actualFinish: 1000000218400 },
        leg
      ];
      
      const effectiveStart = getEffectiveStartTime(leg, legsWithFinish, 1000000000000);
      expect(effectiveStart).toBe(1000000218400);
    });
  });

  describe('calculateTotalDistanceTraveled', () => {
    it('should calculate total distance of finished legs', () => {
      const legsWithFinishes = [
        { ...mockLegs[0], actualFinish: 1000000218400 },
        { ...mockLegs[1], actualFinish: 1000000416800 },
        mockLegs[2] // Not finished
      ];
      
      const totalDistance = calculateTotalDistanceTraveled(legsWithFinishes);
      expect(totalDistance).toBe(10.0); // 5.2 + 4.8
    });

    it('should return 0 when no legs are finished', () => {
      const totalDistance = calculateTotalDistanceTraveled(mockLegs);
      expect(totalDistance).toBe(0);
    });
  });

  describe('initializeRace', () => {
    it('should initialize race with correct leg structure', () => {
      const startTime = 1000000000000;
      const legs = initializeRace(startTime, mockRunners);
      
      expect(legs).toHaveLength(36); // Default 36 legs
      expect(legs[0].projectedStart).toBe(startTime);
      expect(legs[0].runnerId).toBe(mockRunners[0].id);
    });

    it('should assign runners in rotation', () => {
      const startTime = 1000000000000;
      const legs = initializeRace(startTime, mockRunners);
      
      // Check that runners are assigned in rotation (3 runners, so every 3rd leg should be the same runner)
      expect(legs[0].runnerId).toBe(mockRunners[0].id);
      expect(legs[1].runnerId).toBe(mockRunners[1].id);
      expect(legs[2].runnerId).toBe(mockRunners[2].id);
      expect(legs[3].runnerId).toBe(mockRunners[0].id);
    });
  });
});
