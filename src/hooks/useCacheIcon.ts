import React from 'react';
import { useTheme } from "@/hooks/useTheme";
import { CacheIcon } from '@/utils/cacheIcons';

/**
 * Hook-based cache icon component that uses the current theme
 */
export function useCacheIcon(type: string, size: 'sm' | 'md' | 'lg' = 'md', className?: string): React.ReactNode {
  const { theme } = useTheme();
  return React.createElement(CacheIcon, { type, size, className, theme });
}