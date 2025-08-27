import DOMPurify from 'dompurify';

/**
 * Sanitizes user input strings to prevent XSS attacks
 */
export const sanitizeUserInput = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }
  return DOMPurify.sanitize(input.trim());
};

/**
 * Sanitizes all string values in an object recursively
 */
export const sanitizeObject = <T extends Record<string, unknown>>(obj: T): T => {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeUserInput(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeUserInput(item) : item
      );
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
};

/**
 * Validates and sanitizes email addresses
 */
export const sanitizeEmail = (email: string): string | null => {
  const sanitized = sanitizeUserInput(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  return emailRegex.test(sanitized) ? sanitized : null;
};

/**
 * Sanitizes numeric input and ensures it's within valid range
 */
export const sanitizeNumber = (
  input: string | number, 
  min?: number, 
  max?: number
): number | null => {
  const num = typeof input === 'string' ? parseFloat(input) : input;
  
  if (isNaN(num)) {
    return null;
  }
  
  if (min !== undefined && num < min) {
    return null;
  }
  
  if (max !== undefined && num > max) {
    return null;
  }
  
  return num;
};

/**
 * Sanitizes runner names with specific validation rules
 */
export const sanitizeRunnerName = (name: string): string => {
  const sanitized = sanitizeUserInput(name);
  
  // Remove excessive whitespace and limit length
  const cleaned = sanitized.replace(/\s+/g, ' ').substring(0, 50);
  
  // Ensure it's not empty after cleaning
  return cleaned.length > 0 ? cleaned : '';
};

/**
 * Sanitizes pace values (minutes per mile)
 */
export const sanitizePace = (pace: string | number): number | null => {
  const num = sanitizeNumber(pace, 3, 20); // Reasonable pace range: 3-20 min/mile
  
  if (num === null) {
    return null;
  }
  
  // Round to 2 decimal places
  return Math.round(num * 100) / 100;
};

/**
 * Sanitizes distance values (miles)
 */
export const sanitizeDistance = (distance: string | number): number | null => {
  const num = sanitizeNumber(distance, 0.1, 50); // Reasonable distance range: 0.1-50 miles
  
  if (num === null) {
    return null;
  }
  
  // Round to 2 decimal places
  return Math.round(num * 100) / 100;
};

/**
 * Sanitizes time values (milliseconds since epoch)
 */
export const sanitizeTimestamp = (timestamp: string | number): number | null => {
  const num = sanitizeNumber(timestamp, 0);
  
  if (num === null) {
    return null;
  }
  
  // Ensure it's a reasonable timestamp (not too far in past/future)
  const now = Date.now();
  const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
  const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000);
  
  if (num < oneYearAgo || num > oneYearFromNow) {
    return null;
  }
  
  return num;
};
