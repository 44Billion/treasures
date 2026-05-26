import type { GeocacheFormData } from '@/types/geocache-form';
import { getDefaultCacheValues } from '@/utils/geocache-constants';

export function createDefaultGeocacheFormData(): GeocacheFormData {
  const defaults = getDefaultCacheValues();
  return {
    name: "",
    description: "",
    hint: "",
    mission: "",
    difficulty: defaults.difficulty,
    terrain: defaults.terrain,
    size: defaults.size,
    type: defaults.type,
    hidden: false,
    contentWarning: "",
    modifiers: [],
  };
}
