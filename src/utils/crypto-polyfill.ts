/**
 * Browser-compatible crypto.randomUUID polyfill
 * This provides the functionality needed by Mastra in browser environments
 */

// Simple UUID v4 implementation for browser environments
function browserRandomUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Polyfill function that gets called when the module is imported
function applyPolyfill() {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    console.log('[crypto-polyfill] Running in browser environment');
    
    // For the global crypto object
    if (!window.crypto) {
      // @ts-ignore
      window.crypto = {};
    }
    
    if (!window.crypto.randomUUID) {
      console.log('[crypto-polyfill] Adding randomUUID to window.crypto');
      // @ts-ignore
      window.crypto.randomUUID = browserRandomUUID;
    }
  } else if (typeof global !== 'undefined') {
    console.log('[crypto-polyfill] Running in Node-like environment');
    
    // For Node.js or other environments with global
    if (!global.crypto) {
      // @ts-ignore
      global.crypto = {};
    }
    
    if (!(global.crypto as any).randomUUID) {
      console.log('[crypto-polyfill] Adding randomUUID to global.crypto');
      // @ts-ignore
      global.crypto.randomUUID = browserRandomUUID;
    }
  }
  
  // Try to polyfill the CommonJS crypto module for Node/webpack
  try {
    // Check if we have a crypto module in the current scope
    // @ts-ignore
    const crypto = require('crypto');
    if (!crypto.randomUUID) {
      console.log('[crypto-polyfill] Adding randomUUID to crypto module');
      crypto.randomUUID = browserRandomUUID;
    }
  } catch (e) {
    // Crypto module not available or not in a Node environment
    console.log('[crypto-polyfill] Native crypto module not available:', e.message);
  }
  
  return true;
}

// Apply the polyfill immediately
export const cryptoPolyfillLoaded = applyPolyfill();

// Also export the randomUUID function directly for immediate use
export const randomUUID = browserRandomUUID; 