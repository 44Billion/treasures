/**
 * OpenStreetMap location verification
 * Checks if a location is in a restricted area
 */

interface OSMElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
}

interface OSMResponse {
  elements: OSMElement[];
}

export interface LocationVerification {
  isRestricted: boolean;
  warnings: string[];
  nearbyFeatures: {
    name?: string;
    type: string;
    distance?: number;
  }[];
  accessibility: {
    wheelchair?: boolean;
    parking?: boolean;
    publicTransport?: boolean;
    fee?: boolean;
    openingHours?: string;
  };
  terrain: {
    surface?: string;
    difficulty?: string;
    hazards?: string[];
    lit?: boolean;
    covered?: boolean;
    width?: string;
  };
  legal: {
    owner?: string;
    operator?: string;
    restrictions?: string[];
    permits?: string[];
  };
  environmental: {
    nesting?: boolean;
    protected?: string;
    leaveNoTrace?: boolean;
  };
  safety: {
    surveillance?: boolean;
    emergency?: string;
    cellCoverage?: boolean;
    lighting?: string;
  };
}

// Restricted area types and their descriptions
const RESTRICTED_AREAS = {
  // Educational facilities
  'amenity=school': 'School',
  'amenity=kindergarten': 'Kindergarten',
  'amenity=college': 'College',
  'amenity=university': 'University',
  'amenity=childcare': 'Childcare facility',
  
  // Government and military
  'amenity=police': 'Police station',
  'amenity=fire_station': 'Fire station',
  'amenity=courthouse': 'Courthouse',
  'amenity=prison': 'Prison',
  'office=government': 'Government office',
  'military=*': 'Military area',
  'landuse=military': 'Military area',
  
  // Healthcare
  'amenity=hospital': 'Hospital',
  'amenity=clinic': 'Medical clinic',
  
  // Private property indicators (only strict restrictions)
  'access=private': 'Private property',
  'access=no': 'No public access',
  'access=customers': 'Customer-only area',
  'landuse=farmyard': 'Private farm',
  
  // Sensitive infrastructure
  'power=plant': 'Power plant',
  'power=substation': 'Power substation',
  'amenity=water_treatment': 'Water treatment facility',
  
  // Religious sites (may require permission)
  'amenity=place_of_worship': 'Place of worship',
  'landuse=cemetery': 'Cemetery',
  
  // Transportation (may have restrictions)
  'aeroway=aerodrome': 'Airport',
  'railway=station': 'Train station',
  'amenity=bus_station': 'Bus station',
  
  // Additional restrictions
  'boundary=protected_area': 'Protected area',
  'boundary=national_park': 'National park (check regulations)',
  'leisure=nature_reserve': 'Nature reserve (may have restrictions)',
  'landuse=conservation': 'Conservation area',
  'historic=*': 'Historic site (may be protected)',
  'natural=wetland': 'Wetland (environmentally sensitive)',
  
  // Water bodies (caches should not be placed in water)
  'natural=water': 'Body of water',
  'water=*': 'Water feature',
  'waterway=river': 'River', 
  'waterway=canal': 'Canal',
  'waterway=stream': 'Stream',
  'waterway=ditch': 'Drainage ditch',
  'landuse=reservoir': 'Reservoir',
  'leisure=swimming_pool': 'Swimming pool',
  'natural=bay': 'Bay',
  'place=sea': 'Sea',
  'place=ocean': 'Ocean',
};

// Tags that indicate public spaces (generally safe for geocaching)
const PUBLIC_AREAS = [
  'leisure=park',
  'leisure=garden',
  'leisure=recreation_ground',
  'leisure=playground',
  'leisure=nature_reserve',
  'landuse=forest',
  'landuse=grass',
  'natural=wood',
  'natural=grassland',
  'tourism=viewpoint',
  'tourism=picnic_site',
  'highway=footway',
  'highway=path',
  'highway=cycleway',
  'highway=bridleway',
  'highway=steps',
  'amenity=parking', // public parking areas
  'leisure=common',
  'boundary=national_park',
  'landuse=recreation_ground',
  'leisure=dog_park',
];

// Function to score warning specificity (higher score = more specific)
function getWarningSpecificityScore(warning: string): number {
  let score = 0;
  
  // UNDERWATER warnings are the highest priority
  if (warning.includes('UNDERWATER')) score += 5;
  
  // Human-friendly descriptive text is preferred
  if (warning.includes('Location is inside a') || warning.includes('Location is near a')) {
    score += 3; // Prefer descriptive text like "Location is inside a Private property"
  }
  
  // Emoji warnings are more urgent but less human-friendly
  if (warning.includes('⚠️')) score += 2;
  
  // "inside" is more specific than "near"
  if (warning.includes('inside')) score += 1;
  
  // Additional context in parentheses adds specificity
  if (warning.includes('(')) score += 1;
  
  return score;
}

// Helper function to identify water features
function isWaterFeature(key: string, value: string): boolean {
  const waterKeys = ['natural', 'water', 'waterway', 'landuse', 'leisure', 'place'];
  const waterValues = ['water', 'river', 'canal', 'stream', 'ditch', 'reservoir', 'swimming_pool', 'bay', 'sea', 'ocean'];
  
  // Check if this is a water-related tag
  if (waterKeys.includes(key)) {
    // For waterway, any value indicates water
    if (key === 'waterway') return true;
    
    // For water tag, any value indicates water type
    if (key === 'water') return true;
    
    // For other keys, check specific water-related values
    return waterValues.includes(value);
  }
  
  return false;
}

// Check if we're definitively on dry land by analyzing nearby land features
function isDefinitelyOnLand(elements: any[]): boolean {
  for (const element of elements) {
    if (!element.tags) continue;
    
    // Strong indicators of being on land
    if (element.tags.building ||
        element.tags.highway ||
        element.tags.railway ||
        element.tags.amenity ||
        element.tags.landuse ||
        element.tags.leisure ||
        element.tags.shop ||
        element.tags.tourism ||
        element.tags.man_made ||
        element.tags.natural === 'tree' ||
        element.tags.natural === 'grass' ||
        element.tags.natural === 'wood' ||
        element.tags.natural === 'scrub' ||
        element.tags.natural === 'heath' ||
        element.tags.natural === 'grassland' ||
        element.tags.surface ||
        element.tags.barrier ||
        element.tags.power ||
        element.tags.place ||
        element.tags.addr) {
      return true;
    }
  }
  return false;
}

// Conservative water detection - only flag as underwater if we're clearly IN a water body
function isActuallyUnderwater(_lat: number, _lng: number, elements: any[]): boolean {
  // Look for water bodies that we're actually inside of (very close proximity)
  for (const element of elements) {
    if (!element.tags) continue;
    
    // Only consider significant water bodies, not streams or ditches
    const isSignificantWater = (
      element.tags.natural === 'water' ||
      element.tags.landuse === 'reservoir' ||
      element.tags.leisure === 'swimming_pool' ||
      element.tags.waterway === 'river' ||
      element.tags.waterway === 'canal'
    );
    
    if (isSignificantWater) {
      // For ways/areas, check if we have geometry that suggests we're inside
      if (element.type === 'way' && element.nodes) {
        // This is a simplified check - in reality we'd need proper point-in-polygon
        // For now, only flag if it's a very close match (within 10 meters)
        // This is conservative but prevents false positives
        return false; // Disable for now since we can't do proper geometry checks
      }
      
      // For nodes, only flag if it's extremely close (within 5 meters)
      if (element.type === 'node') {
        // We don't have distance calculation here, so be very conservative
        return false;
      }
    }
  }
  
  return false;
}

// Function to clean up duplicate and similar warnings
function cleanupDuplicateWarnings(warnings: string[]): string[] {
  const cleaned: string[] = [];
  
  for (const warning of warnings) {
    const normalizedWarning = warning.toLowerCase().replace(/⚠️\s*/, '');
    
    // Check if we already have a similar warning
    let foundSimilar = false;
    
    for (let i = 0; i < cleaned.length; i++) {
      const existingWarning = cleaned[i];
      const normalizedExisting = existingWarning?.toLowerCase().replace(/⚠️\s*/, '') || '';
      
      // Check for semantic duplicates
      const bothAboutPrivateProperty = normalizedWarning.includes('private property') && normalizedExisting.includes('private property');
      const bothAboutNoAccess = normalizedWarning.includes('no-access area') && normalizedExisting.includes('no-access area');
      const bothAboutBuilding = normalizedWarning.includes('building') && normalizedExisting.includes('building');
      const bothAboutSchool = normalizedWarning.includes('school') && normalizedExisting.includes('school');
      const bothAboutMilitary = normalizedWarning.includes('military') && normalizedExisting.includes('military');
      const bothAboutWater = (normalizedWarning.includes('underwater') || normalizedWarning.includes('water') || 
                            normalizedWarning.includes('river') || normalizedWarning.includes('swimming pool') ||
                            normalizedWarning.includes('canal') || normalizedWarning.includes('stream')) && 
                           (normalizedExisting.includes('underwater') || normalizedExisting.includes('water') || 
                            normalizedExisting.includes('river') || normalizedExisting.includes('swimming pool') ||
                            normalizedExisting.includes('canal') || normalizedExisting.includes('stream'));
      
      if (bothAboutPrivateProperty || bothAboutNoAccess || bothAboutBuilding || bothAboutSchool || bothAboutMilitary || bothAboutWater) {
        // Prefer the more specific version based on multiple criteria
        const warningScore = getWarningSpecificityScore(warning);
        const existingScore = getWarningSpecificityScore(existingWarning || '');
        
        if (warningScore > existingScore) {
          // Replace the existing less specific one with the more specific one
          cleaned[i] = warning;
        }
        // If existing is more specific or equal, keep existing and ignore new one
        foundSimilar = true;
        break;
      }
    }
    
    if (!foundSimilar) {
      cleaned.push(warning);
    }
  }
  
  return cleaned;
}

export async function verifyLocation(lat: number, lng: number): Promise<LocationVerification> {
  const warnings: string[] = [];
  const nearbyFeatures: LocationVerification['nearbyFeatures'] = [];
  const accessibility: LocationVerification['accessibility'] = {};
  const terrain: LocationVerification['terrain'] = { hazards: [] };
  const legal: LocationVerification['legal'] = { restrictions: [], permits: [] };
  const environmental: LocationVerification['environmental'] = {};
  const safety: LocationVerification['safety'] = {};
  
  try {
    // Query Overpass API for features at and near the location
    // Use a conservative approach - only check immediate vicinity for water
    const nearbyRadius = 25; // meters for nearby features
    const waterRadius = 15;   // much smaller radius for water detection - only immediate vicinity
    const query = `
      [out:json][timeout:10];
      (
        // Get ways/areas that might contain this exact point
        way(around:5,${lat},${lng});
        relation(around:5,${lat},${lng});
        
        // Check for water features only in immediate vicinity
        way(around:${waterRadius},${lat},${lng})[natural=water];
        way(around:${waterRadius},${lat},${lng})[landuse=reservoir];
        way(around:${waterRadius},${lat},${lng})[leisure=swimming_pool];
        relation(around:${waterRadius},${lat},${lng})[natural=water];
        
        // Check for major waterways (rivers/canals) in immediate vicinity
        way(around:${waterRadius},${lat},${lng})[waterway~"^(river|canal)$"];
        
        // Also get nearby significant features for land detection
        node(around:${nearbyRadius},${lat},${lng})[amenity];
        node(around:${nearbyRadius},${lat},${lng})[building];
        way(around:${nearbyRadius},${lat},${lng})[amenity];
        way(around:${nearbyRadius},${lat},${lng})[access];
        way(around:${nearbyRadius},${lat},${lng})[leisure];
        way(around:${nearbyRadius},${lat},${lng})[landuse];
        way(around:${nearbyRadius},${lat},${lng})[highway];
        way(around:${nearbyRadius},${lat},${lng})[building];
      );
      out geom tags center;
    `;
    
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!response.ok) {
      return {
        isRestricted: false,
        warnings: ['Unable to verify location restrictions. Please manually verify the location is appropriate.'],
        nearbyFeatures: [],
        accessibility: {},
        terrain: { hazards: [] },
        legal: { restrictions: [], permits: [] },
        environmental: {},
        safety: {},
      };
    }
    
    const data: OSMResponse = await response.json();
    
    // Conservative water detection - assume we're on land unless clearly underwater
    const isOnLand = isDefinitelyOnLand(data.elements);
    
    // Only flag as underwater if we have strong evidence
    const isUnderwater = !isOnLand && isActuallyUnderwater(lat, lng, data.elements);
    
    // Water features are handled in the main processing loop below
    
    // Process all elements for other warnings
    const allElements = data.elements;
    
    for (const element of allElements) {
      if (!element.tags) continue;
      
      // Be much more conservative about what we consider "containing" vs "nearby"
      const isExplicitlyContaining = (
        // Only buildings that are clearly problematic
        (element.tags.building && ['house', 'residential', 'apartments', 'school', 'hospital'].includes(element.tags.building) && element.tags.access !== 'yes') ||
        // Explicit private access within a small area
        (element.tags.access === 'private' && element.type === 'way') ||
        // Specific restricted facility types
        (element.tags.amenity && ['school', 'hospital', 'prison', 'police'].includes(element.tags.amenity))
      );
      
      // Only flag as underwater if we have strong evidence
      const isInWater = isUnderwater;
      
      // Check for restricted areas
      for (const [tagKey, description] of Object.entries(RESTRICTED_AREAS)) {
        const [key, value] = tagKey.split('=');
        if (value === '*') {
          // Wildcard match (e.g., military=*)
          if (key && element.tags && key in element.tags) {
            // Special handling for water bodies
            if (isWaterFeature(key, element.tags[key] || '')) {
              if (isInWater) {
                const waterName = element.tags.name || description.toLowerCase();
                warnings.push(`⚠️ Location is UNDERWATER in ${waterName}`);
              } else {
                // Only warn about significant water bodies nearby, not every stream
                const isSignificantWater = (
                  element.tags.natural === 'water' ||
                  element.tags.landuse === 'reservoir' ||
                  element.tags.leisure === 'swimming_pool' ||
                  (element.tags.waterway && ['river', 'canal'].includes(element.tags.waterway))
                );
                if (isSignificantWater) {
                  warnings.push(`Location is near ${description.toLowerCase()}`);
                }
              }
            } else {
              // Only use "inside" language for explicitly containing elements
              const prefix = isExplicitlyContaining ? 'Location is inside' : 'Location is near';
              warnings.push(`${prefix} a ${description}`);
            }
            nearbyFeatures.push({
              name: element.tags.name,
              type: description,
            });
          }
        } else if (element.tags && key && element.tags[key] === value) {
          // Special handling for water bodies
          if (isWaterFeature(key || '', value || '')) {
            if (isInWater) {
              const waterName = element.tags.name || description.toLowerCase();
              warnings.push(`⚠️ Location is UNDERWATER in ${waterName}`);
            } else {
              // Only warn about significant water bodies nearby, not every stream
              const isSignificantWater = (
                value === 'water' ||
                value === 'reservoir' ||
                value === 'swimming_pool' ||
                (key === 'waterway' && ['river', 'canal'].includes(value || ''))
              );
              if (isSignificantWater) {
                warnings.push(`Location is near ${description.toLowerCase()}`);
              }
            }
          } else {
            // Only use "inside" language for explicitly containing elements  
            const prefix = isExplicitlyContaining ? 'Location is inside' : 'Location is near';
            warnings.push(`${prefix} a ${description}`);
          }
          nearbyFeatures.push({
            name: element.tags.name,
            type: description,
          });
        }
      }
      
      // Check for general access restrictions - only flag as "INSIDE" for explicitly containing elements
      if (isExplicitlyContaining && element.tags.access === 'private') {
        warnings.push('⚠️ Location is INSIDE private property');
      } else if (isExplicitlyContaining && element.tags.access === 'no') {
        warnings.push('⚠️ Location is INSIDE a no-access area');
      } else if (element.tags.access === 'private' && element.tags.amenity) {
        // For non-containing elements, only warn about specific amenities
        warnings.push(`Location is near private property (${element.tags.amenity})`);
      }
      
      // Also check for other access restrictions
      if (element.tags.access === 'customers' || element.tags.access === 'permissive') {
        warnings.push(`Location has restricted access: ${element.tags.access} only`);
      }
      
      // Check building tags - be much more selective
      if (element.tags.building && isExplicitlyContaining) {
        warnings.push('⚠️ Location appears to be inside a building (verify permissions)');
      }
      
      // Add notable nearby features for context
      if (element.tags.name && element.tags.amenity) {
        nearbyFeatures.push({
          name: element.tags.name,
          type: element.tags.amenity,
        });
      }
      
      // Collect accessibility information
      if (element.tags.wheelchair) {
        accessibility.wheelchair = element.tags.wheelchair === 'yes' ? true : 
                                   element.tags.wheelchair === 'no' ? false : undefined;
      }
      if (element.tags.parking) {
        accessibility.parking = element.tags.parking === 'yes' || 
                               element.tags['amenity'] === 'parking';
      }
      if (element.tags.fee) {
        accessibility.fee = element.tags.fee === 'yes';
        if (element.tags.fee === 'yes' && element.tags.charge) {
          warnings.push(`Area may require fee: ${element.tags.charge}`);
        }
      }
      if (element.tags.opening_hours) {
        accessibility.openingHours = element.tags.opening_hours;
        if (element.tags.opening_hours !== '24/7' && !warnings.some(w => w.includes('restricted hours'))) {
          warnings.push(`Area has restricted hours: ${element.tags.opening_hours}`);
        }
      }
      
      // Collect terrain information
      if (element.tags.surface) {
        terrain.surface = element.tags.surface;
      }
      if (element.tags.trail_visibility) {
        terrain.difficulty = element.tags.trail_visibility;
      }
      if (element.tags.sac_scale) {
        terrain.difficulty = `Hiking difficulty: ${element.tags.sac_scale}`;
      }
      
      // Check for hazards
      if (element.tags.hazard) {
        terrain.hazards?.push(element.tags.hazard);
      }
      if (element.tags.flood_prone === 'yes') {
        terrain.hazards?.push('Flood prone area');
      }
      if (element.tags.cliff === 'yes' || element.tags.natural === 'cliff') {
        terrain.hazards?.push('Cliff nearby');
      }
      if (element.tags.waterway) {
        // Only warn about dangerous water hazards
        const dangerousWaterways = ['rapids', 'waterfall'];
        if (dangerousWaterways.includes(element.tags.waterway)) {
          terrain.hazards?.push(`Near ${element.tags.waterway}`);
        }
        // For rivers and canals, only warn if they're very close (already handled above)
      }
      
      // Legal/ownership information
      if (element.tags.owner) {
        legal.owner = element.tags.owner;
      }
      if (element.tags.operator) {
        legal.operator = element.tags.operator;
      }
      
      // Additional access restrictions
      if (element.tags.dog) {
        if (element.tags.dog === 'no') {
          legal.restrictions?.push('No dogs allowed');
        } else if (element.tags.dog === 'leashed') {
          legal.restrictions?.push('Dogs must be leashed');
        }
      }
      if (element.tags.motor_vehicle === 'no') {
        legal.restrictions?.push('No motor vehicles');
      }
      if (element.tags.bicycle === 'no') {
        legal.restrictions?.push('No bicycles');
      }
      
      // Environmental sensitivity
      if (element.tags.protected === 'yes' || element.tags.protection_title) {
        warnings.push(`Protected area: ${element.tags.protection_title || 'Environmental protection'}`);
      }
      
      // Seasonal restrictions
      if (element.tags.seasonal === 'yes' || element.tags.access?.includes('seasonal')) {
        warnings.push('Area may have seasonal restrictions');
      }
      
      // Check for public transport nearby
      if (element.tags.public_transport || 
          element.tags.highway === 'bus_stop' || 
          element.tags.railway === 'station') {
        accessibility.publicTransport = true;
      }
      
      // Additional terrain information
      if (element.tags.lit) {
        terrain.lit = element.tags.lit === 'yes' ? true : 
                     element.tags.lit === 'no' ? false : undefined;
      }
      if (element.tags.covered) {
        terrain.covered = element.tags.covered === 'yes' ? true : 
                         element.tags.covered === 'no' ? false : undefined;
      }
      if (element.tags.width) {
        terrain.width = element.tags.width;
      }
      if (element.tags.incline) {
        terrain.hazards?.push(`Incline: ${element.tags.incline}`);
      }
      if (element.tags.steps) {
        terrain.hazards?.push('Steps/stairs present');
      }
      
      // Environmental concerns - only significant ones
      if (element.tags.nesting_site === 'yes') {
        environmental.nesting = true;
        warnings.push('⚠️ Wildlife nesting area - seasonal restrictions may apply');
      }
      if (element.tags['protected_area:type']) {
        environmental.protected = element.tags['protected_area:type'];
        // Only warn about strict protected areas
        if (element.tags['protected_area:type'].includes('strict') || 
            element.tags.protection_title?.includes('Nature Reserve')) {
          warnings.push(`Strictly protected area: ${element.tags.protection_title || element.tags['protected_area:type']}`);
        }
      }
      if (element.tags.conservation && element.tags.conservation !== 'yes') {
        environmental.leaveNoTrace = true;
        warnings.push('Conservation area - practice Leave No Trace');
      }
      
      // Safety information
      if (element.tags.surveillance || element.tags['camera:type']) {
        safety.surveillance = true;
      }
      if (element.tags.emergency) {
        safety.emergency = element.tags.emergency;
      }
      if (element.tags['mobile_phone:signal']) {
        safety.cellCoverage = element.tags['mobile_phone:signal'] === 'yes' ? true :
                             element.tags['mobile_phone:signal'] === 'no' ? false : undefined;
      }
      if (element.tags.lighting) {
        safety.lighting = element.tags.lighting;
      }
      
      // Legal/permit requirements
      if (element.tags.permit) {
        legal.permits?.push(element.tags.permit);
        warnings.push(`Permit required: ${element.tags.permit}`);
      }
      if (element.tags.reservation === 'required' || element.tags.reservation === 'yes') {
        legal.restrictions?.push('Reservation required');
      }
      
      // Time-based restrictions
      if (element.tags.hour_on || element.tags.hour_off) {
        const hours = `${element.tags.hour_on || '?'} - ${element.tags.hour_off || '?'}`;
        if (!legal.restrictions?.some(r => r.includes('Restricted hours'))) {
          legal.restrictions?.push(`Restricted hours: ${hours}`);
        }
      }
      
      // Noise restrictions
      if (element.tags.quiet === 'yes' || element.tags.silence === 'yes') {
        legal.restrictions?.push('Quiet zone - maintain silence');
      }
      
      // Photography restrictions
      if (element.tags.photography === 'no' || element.tags.photo === 'no') {
        legal.restrictions?.push('Photography prohibited');
      }
      
      // Check for hunting areas
      if (element.tags.hunting === 'yes' || element.tags.leisure === 'hunting_stand') {
        terrain.hazards?.push('⚠️ Hunting area - wear bright colors');
        warnings.push('Hunting area - check seasons and wear safety colors');
      }
      
      // Mining areas
      if (element.tags.landuse === 'quarry' || element.tags.historic === 'mine') {
        terrain.hazards?.push('⚠️ Mining/quarry area - unstable ground');
        warnings.push('Former mining area - beware of unstable ground');
      }
      
      // Water hazards
      if (element.tags.tidal === 'yes') {
        terrain.hazards?.push('⚠️ Tidal area - check tide times');
      }
      if (element.tags.intermittent === 'yes') {
        terrain.hazards?.push('Intermittent water - seasonal flooding');
      }
      
      // Climbing restrictions
      if (element.tags['climbing:forbidden'] === 'yes') {
        legal.restrictions?.push('Climbing forbidden');
      }
      
      // Drone restrictions
      if (element.tags['drone:forbidden'] === 'yes' || element.tags.no_drone === 'yes') {
        legal.restrictions?.push('No drones allowed');
      }
    }
    
    // Check if location is in a public area (good for geocaching)
    const isInPublicArea = data.elements.some(element => {
      if (!element.tags) return false;
      return PUBLIC_AREAS.some(publicTag => {
        const [key, value] = publicTag.split('=');
        return element.tags && key && element.tags[key] === value;
      }) || 
      // Also check for explicit public access
      element.tags.access === 'yes' || element.tags.access === 'public';
    });
    
    if (isInPublicArea) {
      // Location appears to be in a public area - good!
      nearbyFeatures.unshift({
        type: 'Public area - suitable for geocaching',
      });
      
      // If it's clearly public and no serious warnings, don't show minor warnings
      if (warnings.length === 0 || warnings.every(w => 
        w.includes('restricted hours') || 
        w.includes('near') || 
        w.includes('Location feature:')
      )) {
        // Keep only significant warnings for public areas
        const significantWarnings = warnings.filter(w => 
          w.includes('INSIDE') || 
          w.includes('Military') || 
          w.includes('Prison') ||
          w.includes('private property') ||
          w.includes('no-access area')
        );
        warnings.length = 0;
        warnings.push(...significantWarnings);
      }
    }
    
    return {
      isRestricted: warnings.length > 0,
      warnings: cleanupDuplicateWarnings([...new Set(warnings)]), // Remove exact duplicates first, then semantic duplicates
      nearbyFeatures: nearbyFeatures.slice(0, 5), // Limit to 5 most relevant
      accessibility,
      terrain: {
        ...terrain,
        hazards: [...new Set(terrain.hazards || [])], // Remove duplicate hazards
      },
      legal: {
        ...legal,
        restrictions: [...new Set(legal.restrictions || [])], // Remove duplicate restrictions
        permits: [...new Set(legal.permits || [])], // Remove duplicate permits
      },
      environmental,
      safety,
    };
    
  } catch (error) {
    return {
      isRestricted: false,
      warnings: ['Unable to verify location restrictions. Please manually verify the location is appropriate.'],
      nearbyFeatures: [],
      accessibility: {},
      terrain: { hazards: [] },
      legal: { restrictions: [], permits: [] },
      environmental: {},
      safety: {},
    };
  }
}

// Helper function to get a human-readable description of the verification result
export function getVerificationSummary(verification: LocationVerification): {
  status: 'safe' | 'warning' | 'restricted';
  message: string;
} {
  if (verification.warnings.length === 0) {
    if (verification.nearbyFeatures.some(f => f.type.includes('suitable for geocaching'))) {
      return {
        status: 'safe',
        message: 'Location appears to be in a public area suitable for geocaching.',
      };
    }
    return {
      status: 'safe',
      message: 'No restrictions detected at this location.',
    };
  }
  
  // Check for severe restrictions (inside private property, sensitive areas, or underwater)
  if (verification.warnings.some(w => 
    w.includes('UNDERWATER') ||
    w.includes('INSIDE private property') ||
    w.includes('INSIDE a no-access area') ||
    w.includes('inside a building (verify permissions)') ||
    (w.includes('is inside') && (
      w.includes('School') || 
      w.includes('Military') || 
      w.includes('Prison') ||
      w.includes('Hospital') ||
      w.includes('Government')
    ))
  )) {
    return {
      status: 'restricted',
      message: verification.warnings.some(w => w.includes('UNDERWATER')) 
        ? 'This location appears to be underwater.'
        : 'This location appears to be inside a restricted area. Please verify you have permission and the location is appropriate for geocaching.',
    };
  }
  
  // Check for moderate restrictions
  if (verification.warnings.some(w => 
    w.toLowerCase().includes('school') || 
    w.toLowerCase().includes('military') || 
    w.toLowerCase().includes('prison') ||
    w.toLowerCase().includes('private property') ||
    w.toLowerCase().includes('no-access area') ||
    w.toLowerCase().includes('strictly protected area')
  )) {
    return {
      status: 'warning',
      message: 'This location has some restrictions or considerations. Please review the details and verify it is appropriate for geocaching.',
    };
  }
  
  return {
    status: 'warning',
    message: 'This location may have some considerations. Please review the details and verify it is appropriate for geocaching.',
  };
}