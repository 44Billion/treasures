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
  // Most reliable services first (better for Android)
  {
    name: 'ipinfo.io',
    url: 'https://ipinfo.io/json',
    parser: (data: Record<string, unknown>): IPLocation => {
      const [lat, lng] = (data.loc as string).split(',').map(parseFloat);
      return {
        lat,
        lng,
        accuracy: 25000, // More optimistic accuracy for better UX
        source: 'ipinfo.io'
      };
    }
  },
  {
    name: 'ipapi.co',
    url: 'https://ipapi.co/json/',
    parser: (data: Record<string, unknown>): IPLocation => ({
      lat: parseFloat(data.latitude as string),
      lng: parseFloat(data.longitude as string),
      accuracy: 25000,
      source: 'ipapi.co'
    })
  },
  {
    name: 'ipwhois.app',
    url: 'https://ipwhois.app/json/',
    parser: (data: Record<string, unknown>): IPLocation => ({
      lat: parseFloat(data.latitude as string),
      lng: parseFloat(data.longitude as string),
      accuracy: 30000,
      source: 'ipwhois.app'
    })
  },
  // Backup service with different approach
  {
    name: 'ip-api.com',
    url: 'http://ip-api.com/json/',
    parser: (data: Record<string, unknown>): IPLocation => ({
      lat: parseFloat(data.lat as string),
      lng: parseFloat(data.lon as string),
      accuracy: 35000,
      source: 'ip-api.com'
    })
  }
];

export async function getIPLocation(): Promise<IPLocation | null> {
  // Try services sequentially for better reliability on Android
  for (const service of IP_SERVICES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // Slightly longer timeout
      
      const response = await fetch(service.url, {
        signal: controller.signal,
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; GeocachingApp/1.0)', // Some services prefer this
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`IP service ${service.name} returned ${response.status}`);
        continue;
      }
      
      const data = await response.json() as Record<string, unknown>;
      const location = service.parser(data);
      
      // Validate coordinates more thoroughly
      if (
        !isNaN(location.lat) && 
        !isNaN(location.lng) &&
        location.lat >= -90 && 
        location.lat <= 90 &&
        location.lng >= -180 && 
        location.lng <= 180 &&
        location.lat !== 0 && // Exclude null island
        location.lng !== 0
      ) {
        console.log(`IP geolocation success via ${service.name}:`, location);
        return location;
      } else {
        console.warn(`Invalid coordinates from ${service.name}:`, location);
      }
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === 'AbortError') {
        console.warn(`IP service ${service.name} timed out`);
      } else if (err.message?.includes('CORS')) {
        console.warn(`CORS error for ${service.name}, trying next service`);
      } else {
        console.warn(`IP geolocation service ${service.name} failed:`, err.message);
      }
    }
  }
  
  console.warn('All IP geolocation services failed');
  return null;
}