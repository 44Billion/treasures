// Utility functions for geocache display and formatting
import { 
  getDifficultyLabel as getSharedDifficultyLabel,
  getCacheSizeLabel,
  getCacheTypeLabel 
} from './geocache-constants';

export function getDifficultyLabel(difficulty: number): string {
  return getSharedDifficultyLabel(difficulty);
}

export function getTypeLabel(type: string): string {
  return getCacheTypeLabel(type);
}

export function getSizeLabel(size: string): string {
  return getCacheSizeLabel(size);
}

export function getSizeLevel(size: string): number {
  const sizeMap: Record<string, number> = {
    micro: 1,
    small: 2,  
    regular: 3,
    large: 4,
    other: 0, // 'Other' shows no blocks filled (unknown size)
  };
  
  const normalizedSize = size?.toLowerCase()?.trim() || '';
  const level = sizeMap[normalizedSize];
  
  return level !== undefined ? level : 0;
}