// Shared constants for geocache ratings and options
import i18next from 'i18next';

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

// Helper functions to extract labels from options with i18n support
export function getDifficultyLabel(difficulty: number): string {
  const difficultyMap: Record<number, string> = {
    1: i18next.t('geocache.difficulty.easy'),
    2: i18next.t('geocache.difficulty.moderate'),
    3: i18next.t('geocache.difficulty.hard'),
    4: i18next.t('geocache.difficulty.veryHard'),
    5: i18next.t('geocache.difficulty.expert'),
  };
  return difficultyMap[difficulty] || "";
}

export function getTerrainLabel(terrain: number): string {
  return getDifficultyLabel(terrain); // Same mapping for terrain
}

export function getCacheSizeLabel(size: string): string {
  const sizeMap: Record<string, string> = {
    micro: i18next.t('geocache.size.micro'),
    small: i18next.t('geocache.size.small'),
    regular: i18next.t('geocache.size.regular'),
    large: i18next.t('geocache.size.large'),
    other: i18next.t('geocache.size.other'),
  };
  const normalizedSize = size?.toLowerCase()?.trim() || '';
  return sizeMap[normalizedSize] || size.charAt(0).toUpperCase() + size.slice(1);
}

export function getCacheTypeLabel(type: string): string {
  const typeMap: Record<string, string> = {
    traditional: i18next.t('geocache.type.traditional'),
    multi: i18next.t('geocache.type.multi'),
    mystery: i18next.t('geocache.type.mystery'),
  };
  const normalizedType = type?.toLowerCase()?.trim() || '';
  return typeMap[normalizedType] || type;
}

// Default values for new geocaches  
export function getDefaultCacheValues() {
  return {
    difficulty: DIFFICULTY_TERRAIN_OPTIONS[0]?.value || "1", // "1"
    terrain: DIFFICULTY_TERRAIN_OPTIONS[0]?.value || "1", // "1"  
    size: CACHE_SIZE_OPTIONS.find(opt => opt.value === "regular")?.value || CACHE_SIZE_OPTIONS[0]?.value || "regular",
    type: CACHE_TYPE_OPTIONS[0]?.value || "traditional", // "traditional"
  };
}