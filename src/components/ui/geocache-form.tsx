// Backward compatibility re-export
// This file maintains compatibility while components are migrated to the new structure

export { GeocacheForm } from '@/features/geocache/components/geocache-form';
export type { GeocacheFormData, GeocacheFormProps } from '@/features/geocache/types/geocache-form';
export { createDefaultGeocacheFormData, validateGeocacheForm } from '@/features/geocache/utils/geocache-form-utils';
export { CacheNameField } from '@/features/geocache/components/geocache-form';
export { CacheDescriptionField } from '@/features/geocache/components/geocache-form';
export { CacheHintField } from '@/features/geocache/components/geocache-form';
export { CacheTypeField } from '@/features/geocache/components/geocache-form';
export { CacheSizeField } from '@/features/geocache/components/geocache-form';
export { CacheDifficultyField } from '@/features/geocache/components/geocache-form';
export { CacheTerrainField } from '@/features/geocache/components/geocache-form';
export { CacheImageManager } from '@/features/geocache/components/geocache-form';
export { CacheHiddenField } from '@/features/geocache/components/geocache-form';