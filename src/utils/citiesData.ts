/**
 * Lazy-loaded cities data module
 * This file is code-split into a separate chunk to avoid bloating the main bundle
 */

import cities from 'cities.json';

export interface CityData {
  name: string;
  country: string;
  lat: string;
  lng: string;
  admin1?: string; // State/province code (GeoNames format)
  admin2?: string; // County/region code
}

export function getCitiesData(): CityData[] {
  return cities as CityData[];
}
