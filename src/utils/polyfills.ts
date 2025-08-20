// Polyfills for Node.js modules in browser environment
import { Buffer } from 'buffer';
import process from 'process';

// Make Buffer available globally
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).process = process;
}

// Ensure util.inherits is available
if (typeof window !== 'undefined') {
  // Create a more comprehensive util polyfill
  (window as any).util = {
    inherits: function(ctor: any, superCtor: any) {
      if (ctor === undefined || ctor === null)
        throw new TypeError('The constructor to "inherits" must not be null or undefined');
      if (superCtor === undefined || superCtor === null)
        throw new TypeError('The super constructor to "inherits" must not be null or undefined');
      if (superCtor.prototype === undefined)
        throw new TypeError('The super constructor to "inherits" must have a prototype');
      ctor.super_ = superCtor;
      Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
    },
    // Add other commonly used util functions
    format: function(format: string, ...args: any[]) {
      return format.replace(/%s/g, () => args.shift());
    },
    inspect: function(obj: any) {
      return JSON.stringify(obj, null, 2);
    }
  };
}

// Ensure global is available
if (typeof global === 'undefined') {
  (window as any).global = window;
}

export {};
