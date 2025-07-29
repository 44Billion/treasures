import { GeocacheFormData } from '@/features/geocache/types/geocache-form';
import { getDefaultCacheValues } from '@/features/geocache/utils/geocache-constants';

export function createDefaultGeocacheFormData(): GeocacheFormData {
  const defaults = getDefaultCacheValues();
  return {
    name: "",
    description: "",
    hint: "",
    difficulty: defaults.difficulty,
    terrain: defaults.terrain,
    size: defaults.size,
    type: defaults.type,
    hidden: false,
  };
}

export function validateGeocacheForm(formData: GeocacheFormData): string[] {
  const errors: string[] = [];
  
  if (!formData.name.trim()) {
    errors.push("Cache name is required");
  }
  
  if (!formData.description.trim()) {
    errors.push("Description is required");
  }
  
  return errors;
}