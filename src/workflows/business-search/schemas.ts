import { z } from 'zod';
import { Business } from '@/types/business';

/**
 * Input schema for the business search workflow
 */
export const businessSearchInputSchema = z.object({
  query: z.string().min(1, "Search query is required").describe("Search query for businesses"),
  location: z.string().min(1, "Location is required").describe("Location to search in"),
  radius: z.number().optional().default(25).describe("Search radius in kilometers")
});

export type BusinessSearchInput = z.infer<typeof businessSearchInputSchema>;

/**
 * Schema for business search results
 */
export const businessSearchResultSchema = z.object({
  businesses: z.array(z.any()).describe("List of businesses found"),
  count: z.number().describe("Number of businesses found"),
  location: z.string().describe("Location that was searched"),
  query: z.string().describe("Search query that was used")
});

export type BusinessSearchResult = z.infer<typeof businessSearchResultSchema>;

/**
 * Schema for enhanced business results
 */
export const enhancedBusinessResultSchema = z.object({
  businesses: z.array(z.custom<Business>()).describe("List of enhanced businesses"),
  count: z.number().describe("Number of businesses"),
  location: z.string().optional().describe("Location of the businesses"),
  query: z.string().optional().describe("Query used to find the businesses")
});

export type EnhancedBusinessResult = z.infer<typeof enhancedBusinessResultSchema>; 