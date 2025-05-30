import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Zap, Shield } from "lucide-react";
import { LocationPicker } from "@/components/LocationPicker";
import { EnhancedLocationPicker } from "@/components/EnhancedLocationPicker";
import { isFirefoxAndroid, isFirefoxMobile } from "@/lib/firefoxAndroidGeolocation";

interface LocationPickerSelectorProps {
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number }) => void;
  autoSelect?: boolean;
}

type PickerType = 'auto' | 'enhanced' | 'original';

export function LocationPickerSelector({ value, onChange, autoSelect = true }: LocationPickerSelectorProps) {
  const [selectedPicker, setSelectedPicker] = useState<PickerType>('auto');

  const getRecommendedPicker = (): 'enhanced' | 'original' => {
    // Always recommend enhanced for Firefox users
    if (isFirefoxAndroid() || isFirefoxMobile()) {
      return 'enhanced';
    }
    
    // For other browsers, enhanced is still better but original works fine
    return 'enhanced';
  };

  const getActivePicker = (): 'enhanced' | 'original' => {
    if (selectedPicker === 'auto') {
      return getRecommendedPicker();
    }
    return selectedPicker as 'enhanced' | 'original';
  };

  const activePicker = getActivePicker();
  const recommended = getRecommendedPicker();

  if (autoSelect && selectedPicker === 'auto') {
    // Auto-select mode: just show the recommended picker
    return activePicker === 'enhanced' ? (
      <EnhancedLocationPicker value={value} onChange={onChange} prioritizePrecision={true} />
    ) : (
      <LocationPicker value={value} onChange={onChange} />
    );
  }

  return (
    <div className="space-y-4">
      {/* Picker Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Location Picker Options</CardTitle>
          <CardDescription>
            Choose the location picker that works best for your browser
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {/* Auto Selection */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    Auto-Select
                    <Badge variant="default" className="text-xs">Recommended</Badge>
                  </div>
                  <div className="text-xs text-gray-600">
                    Automatically chooses the best picker for your browser
                  </div>
                </div>
              </div>
              <Button
                variant={selectedPicker === 'auto' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPicker('auto')}
              >
                {selectedPicker === 'auto' ? 'Selected' : 'Select'}
              </Button>
            </div>

            {/* Enhanced Picker */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    Enhanced Picker
                    {recommended === 'enhanced' && (
                      <Badge variant="secondary" className="text-xs">Best for you</Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-600">
                    Progressive fallback, Firefox Android support, troubleshooting
                  </div>
                </div>
              </div>
              <Button
                variant={selectedPicker === 'enhanced' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPicker('enhanced')}
              >
                {selectedPicker === 'enhanced' ? 'Selected' : 'Select'}
              </Button>
            </div>

            {/* Original Picker */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium text-sm">Original Picker</div>
                  <div className="text-xs text-gray-600">
                    Simple, lightweight, works well on most browsers
                  </div>
                </div>
              </div>
              <Button
                variant={selectedPicker === 'original' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPicker('original')}
              >
                {selectedPicker === 'original' ? 'Selected' : 'Select'}
              </Button>
            </div>
          </div>

          {/* Browser-specific recommendations */}
          {(isFirefoxAndroid() || isFirefoxMobile()) && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Firefox detected:</strong> The Enhanced Picker is strongly recommended 
                for better location support on Firefox mobile browsers.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Active Picker */}
      <div>
        {activePicker === 'enhanced' ? (
          <EnhancedLocationPicker 
            value={value} 
            onChange={onChange} 
            prioritizePrecision={true}
          />
        ) : (
          <LocationPicker 
            value={value} 
            onChange={onChange}
          />
        )}
      </div>

      {/* Current Selection Info */}
      <div className="text-center text-sm text-gray-600">
        Currently using: <strong>
          {selectedPicker === 'auto' ? `Auto (${activePicker})` : selectedPicker} picker
        </strong>
      </div>
    </div>
  );
}