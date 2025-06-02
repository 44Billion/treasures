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
    parser: (data: Record<string, unknown>): IPLocation => ({
      lat: parseFloat(data.latitude as string),
      lng: parseFloat(data.longitude as string),
      accuracy: 50000, // 50km accuracy for IP-based
      source: 'ipapi.co'
    })
  },
  {
    name: 'ipinfo.io',
    url: 'https://ipinfo.io/json',
    parser: (data: Record<string, unknown>): IPLocation => {
      const [lat, lng] = (data.loc as string).split(',').map(parseFloat);
      return {
        lat,
        lng,
        accuracy: 50000,
        source: 'ipinfo.io'
      };
    }
  },
  {
    name: 'ipwhois.app',
    url: 'https://ipwhois.app/json/',
    parser: (data: Record<string, unknown>): IPLocation => ({
      lat: parseFloat(data.latitude as string),
      lng: parseFloat(data.longitude as string),
      accuracy: 50000,
      source: 'ipwhois.app'
    })
  }
];

export async function getIPLocation(): Promise<IPLocation | null> {
  // Try all services in parallel for faster response
  const promises = IP_SERVICES.map(async (service) => {
    try {
      const response = await fetch(service.url, {
        signal: AbortSignal.timeout(3000), // Shorter timeout for faster fallback
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
        }
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
        return location;
      }
    } catch (error) {
      // Only log non-CORS errors to reduce console noise
      if (error instanceof TypeError && error.message.includes('CORS')) {
      } else {
      }
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