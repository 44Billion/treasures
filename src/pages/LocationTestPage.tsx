import { useState } from 'react';
import { LocationPicker } from '@/components/LocationPicker';
import { useGeolocation } from '@/hooks/useGeolocation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

export function LocationTestPage() {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { loading, error, coords, getLocation } = useGeolocation();

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Location Test</h1>
        <p className="text-gray-600">
          Test location services on your device
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>useGeolocation Hook Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={getLocation} 
              disabled={loading}
              className="w-full"
            >
              <MapPin className="h-4 w-4 mr-2" />
              {loading ? 'Getting Location...' : 'Get My Location'}
            </Button>

            {error && (
              <div className="p-3 bg-red-50 rounded border border-red-200">
                <h4 className="font-medium text-red-800">Error:</h4>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {coords && (
              <div className="p-3 bg-green-50 rounded border border-green-200">
                <h4 className="font-medium text-green-800">Location Found:</h4>
                <div className="text-sm text-green-700 space-y-1">
                  <p>Latitude: {coords.latitude.toFixed(6)}</p>
                  <p>Longitude: {coords.longitude.toFixed(6)}</p>
                  <p>Accuracy: ±{Math.round(coords.accuracy)}m</p>
                  {coords.altitude && <p>Altitude: {Math.round(coords.altitude)}m</p>}
                  {coords.heading && <p>Heading: {Math.round(coords.heading)}°</p>}
                  {coords.speed && <p>Speed: {Math.round(coords.speed * 3.6)} km/h</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location Picker Test</CardTitle>
          </CardHeader>
          <CardContent>
            <LocationPicker 
              value={selectedLocation} 
              onChange={setSelectedLocation} 
            />
            
            {selectedLocation && (
              <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
                <h4 className="font-medium text-green-800">Selected Location:</h4>
                <p className="text-sm text-green-700">
                  Latitude: {selectedLocation.lat.toFixed(6)}<br />
                  Longitude: {selectedLocation.lng.toFixed(6)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}