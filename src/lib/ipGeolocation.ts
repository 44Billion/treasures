/**
 * Fallback geolocation using IP address
 * Uses multiple free services with no API key required
 */

interface IPLocation {
  lat: number;
  lng: number;
  accuracy: number;
  source: string;
}

const IP_SERVICES = [
  {
    name: 'ipapi.co',
    url: 'https://ipapi.co/json/',
    parser: (data: any): IPLocation => ({
      lat: parseFloat(data.latitude),
      lng: parseFloat(data.longitude),
      accuracy: 50000, // 50km accuracy for IP-based
      source: 'ipapi.co'
    })
  },
  {
    name: 'ip-api.com',
    url: 'http://ip-api.com/json/',
    parser: (data: any): IPLocation => ({
      lat: data.lat,
      lng: data.lon,
      accuracy: 50000,
      source: 'ip-api.com'
    })
  },
  {
    name: 'ipinfo.io',
    url: 'https://ipinfo.io/json',
    parser: (data: any): IPLocation => {
      const [lat, lng] = data.loc.split(',').map(parseFloat);
      return {
        lat,
        lng,
        accuracy: 50000,
        source: 'ipinfo.io'
      };
    }
  }
];

export async function getIPLocation(): Promise<IPLocation | null> {
  // Try all services in parallel for faster response
  const promises = IP_SERVICES.map(async (service) => {
    try {
      const response = await fetch(service.url, {
        signal: AbortSignal.timeout(3000) // Shorter timeout for faster fallback
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      const location = service.parser(data);
      
      // Validate coordinates
      if (
        !isNaN(location.lat) && 
        !isNaN(location.lng) &&
        location.lat >= -90 && 
        location.lat <= 90 &&
        location.lng >= -180 && 
        location.lng <= 180
      ) {
        console.log(`IP geolocation successful via ${service.name}`);
        return location;
      }
    } catch (error) {
      console.error(`IP geolocation failed for ${service.name}:`, error);
    }
    return null;
  });

  // Race all promises and return the first successful one
  const results = await Promise.allSettled(promises);
  
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      return result.value;
    }
  }
  
  return null;
}