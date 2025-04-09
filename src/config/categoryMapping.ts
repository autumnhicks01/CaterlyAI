/**
 * Category mapping configuration for outreach campaigns
 * 
 * This configuration maps detailed venue/business categories from the database
 * to the three main outreach categories used for email campaigns:
 * - wedding (includes event venues and spaces)
 * - education (includes schools and educational institutions)
 * - corporate (includes business venues and other commercial spaces)
 */

// Map database categories to outreach categories
export const CATEGORY_GROUPS = {
  wedding: [
    'wedding venue', 
    'event venue', 
    'event space'
  ],
  education: [
    'school', 
    'university', 
    'education center',
    'college',
    'academy',
    'church',
    'religious institution'
  ],
  corporate: [
    'country club',
    'golf club',
    'corporate office',
    'business center',
    'restaurant',
    'hotel',
    'conference center',
    'coworking space'
  ]
};

// Function to map a detailed category to an outreach category
export function mapToOutreachCategory(detailedCategory: string): string {
  // Convert to lowercase for case-insensitive matching
  const category = detailedCategory.toLowerCase().trim();
  
  // Check each outreach category group
  for (const [outreachCategory, detailedCategories] of Object.entries(CATEGORY_GROUPS)) {
    if (detailedCategories.some(c => category.includes(c) || c.includes(category))) {
      return outreachCategory;
    }
  }
  
  // Default to corporate for any unrecognized categories
  return 'corporate';
}

// Function to get all possible detailed categories
export function getAllDetailedCategories(): string[] {
  return Object.values(CATEGORY_GROUPS).flat();
}

// Function to get all outreach categories
export function getOutreachCategories(): string[] {
  return Object.keys(CATEGORY_GROUPS);
} 