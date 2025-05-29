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
    };
    
  } catch (error) {
    console.error('Error verifying location:', error);
    return {
      isRestricted: false,
      warnings: ['Unable to verify location restrictions. Please manually verify the location is appropriate.'],
      nearbyFeatures: [],
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