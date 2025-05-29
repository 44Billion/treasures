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
  
  // Private property indicators
  'access=private': 'Private property',
  'access=no': 'No public access',
  'access=customers': 'Customer-only area',
  'landuse=residential': 'Residential area',
  'landuse=commercial': 'Commercial property',
  'landuse=industrial': 'Industrial property',
  'landuse=farmyard': 'Private farm',
  'landuse=farmland': 'Agricultural land',
  
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
};

// Tags that indicate public spaces (generally safe for geocaching)
const PUBLIC_AREAS = [
  'leisure=park',
  'leisure=garden',
  'leisure=nature_reserve',
  'landuse=forest',
  'natural=wood',
  'tourism=viewpoint',
  'tourism=picnic_site',
  'highway=footway',
  'highway=path',
  'highway=cycleway',
];

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
    const radius = 50; // meters for nearby features
    const query = `
      [out:json][timeout:10];
      (
        // Get ways/areas that contain this point
        way(around:1,${lat},${lng});
        relation(around:1,${lat},${lng});
        
        // Also get nearby features within radius
        node(around:${radius},${lat},${lng});
        way(around:${radius},${lat},${lng});
        relation(around:${radius},${lat},${lng});
      );
      out tags center;
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
      console.error('Overpass API error:', response.status);
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
    
    // Separate elements by distance (at location vs nearby)
    const elementsAtLocation: OSMElement[] = [];
    const elementsNearby: OSMElement[] = [];
    
    // Check each element for restricted tags
    for (const element of data.elements) {
      if (!element.tags) continue;
      
      // Determine if this element is at the exact location or just nearby
      // Elements with center info that are very close (within 1-2m) are considered "at location"
      const isAtLocation = element.type === 'way' || element.type === 'relation';
      
      if (isAtLocation) {
        elementsAtLocation.push(element);
      } else {
        elementsNearby.push(element);
      }
      
      // Check for restricted areas
      for (const [tagKey, description] of Object.entries(RESTRICTED_AREAS)) {
        const [key, value] = tagKey.split('=');
        
        if (value === '*') {
          // Wildcard match (e.g., military=*)
          if (key in element.tags) {
            const prefix = isAtLocation ? 'Location is inside' : 'Location is near';
            warnings.push(`${prefix} a ${description}`);
            nearbyFeatures.push({
              name: element.tags.name,
              type: description,
            });
          }
        } else if (element.tags[key] === value) {
          const prefix = isAtLocation ? 'Location is inside' : 'Location is near';
          warnings.push(`${prefix} a ${description}`);
          nearbyFeatures.push({
            name: element.tags.name,
            type: description,
          });
        }
      }
      
      // Check for general access restrictions with more detail
      if (element.tags.access === 'private') {
        if (isAtLocation) {
          warnings.push('⚠️ Location is INSIDE private property');
        } else {
          warnings.push('Location is near private property');
        }
      } else if (element.tags.access === 'no') {
        if (isAtLocation) {
          warnings.push('⚠️ Location is INSIDE a no-access area');
        } else {
          warnings.push('Location is near a no-access area');
        }
      }
      
      // Also check for other access restrictions
      if (element.tags.access === 'customers' || element.tags.access === 'permissive') {
        warnings.push(`Location has restricted access: ${element.tags.access} only`);
      }
      
      // Check building tags which often indicate private property
      if (element.tags.building && isAtLocation) {
        // Most buildings are private unless specifically marked otherwise
        if (!element.tags.access || element.tags.access !== 'yes') {
          warnings.push('⚠️ Location appears to be inside a building (likely private)');
        }
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
        accessibility.wheelchair = element.tags.wheelchair === 'yes';
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
        if (element.tags.opening_hours !== '24/7') {
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
        terrain.hazards?.push(`Near ${element.tags.waterway}`);
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
        terrain.lit = element.tags.lit === 'yes';
      }
      if (element.tags.covered) {
        terrain.covered = element.tags.covered === 'yes';
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
      
      // Environmental concerns
      if (element.tags.nesting_site === 'yes') {
        environmental.nesting = true;
        warnings.push('⚠️ Wildlife nesting area - seasonal restrictions may apply');
      }
      if (element.tags['protected_area:type']) {
        environmental.protected = element.tags['protected_area:type'];
      }
      if (element.tags.conservation) {
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
        safety.cellCoverage = element.tags['mobile_phone:signal'] !== 'no';
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
        return element.tags![key] === value;
      });
    });
    
    if (isInPublicArea && warnings.length === 0) {
      // Location appears to be in a public area - good!
      nearbyFeatures.unshift({
        type: 'Public area - suitable for geocaching',
      });
    }
    
    return {
      isRestricted: warnings.length > 0,
      warnings: [...new Set(warnings)], // Remove duplicates
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
    console.error('Error verifying location:', error);
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
  
  // Check for severe restrictions (inside private property or sensitive areas)
  if (verification.warnings.some(w => 
    w.includes('INSIDE private property') ||
    w.includes('INSIDE a no-access area') ||
    w.includes('inside a building') ||
    w.includes('is inside') && (
      w.includes('School') || 
      w.includes('Military') || 
      w.includes('Prison') ||
      w.includes('Hospital') ||
      w.includes('Government')
    )
  )) {
    return {
      status: 'restricted',
      message: 'This location is inside a restricted area. Please choose a different location.',
    };
  }
  
  // Check for moderate restrictions (near but not inside)
  if (verification.warnings.some(w => 
    w.includes('School') || 
    w.includes('Military') || 
    w.includes('Prison') ||
    w.includes('private property') ||
    w.includes('no-access area')
  )) {
    return {
      status: 'warning',
      message: 'This location is near restricted areas. Please verify it is appropriate for a geocache.',
    };
  }
  
  return {
    status: 'warning',
    message: 'This location may have restrictions. Please verify it is appropriate for a geocache.',
  };
}