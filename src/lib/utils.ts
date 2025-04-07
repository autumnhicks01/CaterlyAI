import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * General utility functions
 */

/**
 * Safely stringify objects for LLM prompts with indentation
 * @param obj - Object to stringify
 * @param spaces - Number of spaces for indentation (default: 2)
 * @returns Stringified object or fallback string if error occurs
 */
export function stringify(obj: any, spaces = 2): string {
  try {
    return JSON.stringify(obj, null, spaces);
  } catch (error) {
    console.error('Error stringifying object:', error);
    return String(obj);
  }
}

/**
 * Safely parse JSON from string
 * @param text - JSON string to parse
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed object or defaultValue if parsing fails
 */
export function parseJson<T = any>(text: string, defaultValue: T | null = null): T | null {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return defaultValue;
  }
}

/**
 * Extract JSON from LLM response text which may be wrapped in markdown code blocks
 * @param text - LLM response text
 * @param defaultValue - Default value if extraction or parsing fails
 * @returns Extracted and parsed JSON or defaultValue if failed
 */
export function extractJsonFromLlmResponse<T = any>(text: string, defaultValue: T | null = null): T | null {
  try {
    // Try to find JSON in code blocks first
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                      text.match(/```\n([\s\S]*?)\n```/) || 
                      [null, text];
    
    const jsonText = jsonMatch[1] || text;
    return JSON.parse(jsonText) as T;
  } catch (error) {
    console.error('Error extracting JSON from LLM response:', error);
    return defaultValue;
  }
}

/**
 * Format a date to a localized string
 * @param date - Date to format
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted date string
 */
export function formatDate(date: Date | string | number, locale = 'en-US'): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateObj.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Truncate a string to the specified length with ellipsis
 * @param str - String to truncate
 * @param length - Maximum length (default: 100)
 * @returns Truncated string
 */
export function truncate(str: string, length = 100): string {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

/**
 * Deep merge two objects together
 * @param target - Target object
 * @param source - Source object to merge into target
 * @returns Merged object
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      const sourceValue = source[key as keyof typeof source];
      const targetValue = target[key as keyof typeof target];
      
      if (isObject(sourceValue)) {
        if (!(key in target)) {
          Object.assign(output, { [key]: sourceValue });
        } else {
          (output as any)[key] = deepMerge(
            targetValue as Record<string, any>,
            sourceValue as Record<string, any>
          );
        }
      } else {
        Object.assign(output, { [key]: sourceValue });
      }
    });
  }
  
  return output;
}

/**
 * Check if a value is an object
 * @param item - Value to check
 * @returns True if item is an object
 */
function isObject(item: any): boolean {
  return (item && typeof item === 'object' && !Array.isArray(item));
} 