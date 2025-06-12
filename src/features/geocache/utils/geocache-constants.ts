// Shared constants for geocache ratings and options

export const DIFFICULTY_TERRAIN_OPTIONS = [
  { value: "1", label: "1 - Easy" },
  { value: "2", label: "2 - Moderate" },
  { value: "3", label: "3 - Hard" },
  { value: "4", label: "4 - Very Hard" },
  { value: "5", label: "5 - Expert" },
];

export const CACHE_SIZE_OPTIONS = [
  { value: "micro", label: "Micro" },
  { value: "small", label: "Small" },
  { value: "regular", label: "Regular" },
  { value: "large", label: "Large" },
  { value: "other", label: "Other" },
];

export const CACHE_TYPE_OPTIONS = [
  { value: "traditional", label: "Traditional" },
  { value: "multi", label: "Multi-cache" },
  { value: "mystery", label: "Mystery/Puzzle" },
];

// Helper functions to extract labels from options
export function getDifficultyLabel(difficulty: number): string {
  const option = DIFFICULTY_TERRAIN_OPTIONS.find(opt => opt.value === difficulty.toString());
  return option?.label.split(' - ')[1] || ""; // Return just "Easy", "Hard", etc.
}

export function getTerrainLabel(terrain: number): string {
  const option = DIFFICULTY_TERRAIN_OPTIONS.find(opt => opt.value === terrain.toString());
  return option?.label.split(' - ')[1] || ""; // Return just "Easy", "Hard", etc.
}

export function getCacheSizeLabel(size: string): string {
  const option = CACHE_SIZE_OPTIONS.find(opt => opt.value === size.toLowerCase());
  return option?.label || size.charAt(0).toUpperCase() + size.slice(1);
}

export function getCacheTypeLabel(type: string): string {
  const option = CACHE_TYPE_OPTIONS.find(opt => opt.value === type.toLowerCase());
  return option?.label || type;
}

// Default values for new geocaches  
export function getDefaultCacheValues() {
  return {
    difficulty: DIFFICULTY_TERRAIN_OPTIONS[0].value, // "1"
    terrain: DIFFICULTY_TERRAIN_OPTIONS[0].value, // "1"  
    size: CACHE_SIZE_OPTIONS.find(opt => opt.value === "regular")?.value || CACHE_SIZE_OPTIONS[0].value,
    type: CACHE_TYPE_OPTIONS[0].value, // "traditional"
  };
}