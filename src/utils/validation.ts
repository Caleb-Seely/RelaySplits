import { z } from 'zod';

// Base schemas for common data types
export const RunnerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
  pace: z.string().regex(/^\d{1,2}:\d{2}$/, 'Pace must be in MM:SS format'),
  van: z.string().regex(/^[12]$/, 'Van must be 1 or 2'),
  team_id: z.string().uuid().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const LegSchema = z.object({
  id: z.number().int().positive(),
  team_id: z.string().uuid().optional(),
  runner_id: z.string().uuid().optional(),
  distance: z.number().positive().max(100, 'Distance too long'),
  projected_start: z.number().optional(),
  projected_finish: z.number().optional(),
  actual_start: z.number().optional(),
  actual_finish: z.number().optional(),
  status: z.enum(['ready', 'running', 'finished', 'next']).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const TeamSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Team name is required').max(100, 'Team name too long').trim(),
  start_time: z.number().positive(),
  owner_id: z.string().uuid().optional(),
  invite_token: z.string().uuid().optional(),
  admin_secret: z.string().min(10, 'Admin secret too short').optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// Input sanitization functions
export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove < and > to prevent XSS
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

export const sanitizeNumber = (input: any): number => {
  const num = Number(input);
  return isNaN(num) ? 0 : Math.max(0, num);
};

export const sanitizeDate = (input: any): number => {
  const date = new Date(input);
  return isNaN(date.getTime()) ? Date.now() : date.getTime();
};

// Validation functions with sanitization
export const validateRunner = (data: any) => {
  try {
    const sanitized = {
      ...data,
      name: sanitizeString(data.name),
      pace: sanitizeString(data.pace),
      van: sanitizeString(data.van),
    };
    return { success: true, data: RunnerSchema.parse(sanitized) };
  } catch (error) {
    return { success: false, error: error instanceof z.ZodError ? error.errors : 'Validation failed' };
  }
};

export const validateLeg = (data: any) => {
  try {
    const sanitized = {
      ...data,
      distance: sanitizeNumber(data.distance),
      projected_start: data.projected_start ? sanitizeDate(data.projected_start) : undefined,
      projected_finish: data.projected_finish ? sanitizeDate(data.projected_finish) : undefined,
      actual_start: data.actual_start ? sanitizeDate(data.actual_start) : undefined,
      actual_finish: data.actual_finish ? sanitizeDate(data.actual_finish) : undefined,
    };
    return { success: true, data: LegSchema.parse(sanitized) };
  } catch (error) {
    return { success: false, error: error instanceof z.ZodError ? error.errors : 'Validation failed' };
  }
};

export const validateTeam = (data: any) => {
  try {
    const sanitized = {
      ...data,
      name: sanitizeString(data.name),
      start_time: sanitizeDate(data.start_time),
    };
    return { success: true, data: TeamSchema.parse(sanitized) };
  } catch (error) {
    return { success: false, error: error instanceof z.ZodError ? error.errors : 'Validation failed' };
  }
};

// Rate limiting utility
export class RateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number = 10, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempt = this.attempts.get(key);

    if (!attempt || now > attempt.resetTime) {
      this.attempts.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (attempt.count >= this.maxAttempts) {
      return false;
    }

    attempt.count++;
    return true;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

// Data integrity checks
export const validateDataIntegrity = (data: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check for required fields
  if (!data) {
    errors.push('Data is required');
    return { valid: false, errors };
  }

  // Check for circular references
  try {
    JSON.stringify(data);
  } catch (error) {
    errors.push('Data contains circular references');
  }

  // Check for excessive data size (prevent DoS)
  const dataSize = JSON.stringify(data).length;
  if (dataSize > 1000000) { // 1MB limit
    errors.push('Data size exceeds limit');
  }

  return { valid: errors.length === 0, errors };
};

// Export schemas for use in components
export { RunnerSchema, LegSchema, TeamSchema };
