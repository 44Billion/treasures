import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import L from 'leaflet';

interface SearchInViewButtonProps {
  map: L.Map;
  onSearchInView: (bounds: L.LatLngBounds) => void;
  isAdventureTheme?: boolean;
}

export function SearchInViewButton({ map, onSearchInView, isAdventureTheme = false }: SearchInViewButtonProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Check if user has moved the map from its initial position
  const checkMapMovement = () => {
    const center = map.getCenter();
    const zoom = map.getZoom();
    
    // Get the initial center from map options or use a default
    const initialCenter = map.options.center as [number, number] || [40.7128, -74.0060];
    const initialZoom = map.options.zoom || 10;
    
    // Check if map has been moved significantly (more than 0.01 degrees or zoom changed)
    const hasMoved = 
      Math.abs(center.lat - initialCenter[0]) > 0.01 || 
      Math.abs(center.lng - initialCenter[1]) > 0.01 ||
      zoom !== initialZoom;
    
    setIsVisible(hasMoved);
  };

  // Set up event listeners to track map movement
  useEffect(() => {
    // Check initial state after map is ready
    const timer = setTimeout(checkMapMovement, 100);
    
    // Listen for map movements
    map.on('moveend', checkMapMovement);
    map.on('zoomend', checkMapMovement);
    
    return () => {
      clearTimeout(timer);
      map.off('moveend', checkMapMovement);
      map.off('zoomend', checkMapMovement);
    };
  }, [map]);

  const handleSearchInView = async () => {
    if (isSearching) return;
    
    setIsSearching(true);
    try {
      const bounds = map.getBounds();
      await onSearchInView(bounds);
    } finally {
      setIsSearching(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Button
      variant={isAdventureTheme ? "default" : "secondary"}
      size="sm"
      className={`
        h-8 px-4 text-xs whitespace-nowrap transition-all duration-200
        ${isAdventureTheme 
          ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700' 
          : 'bg-background/95 backdrop-blur-sm hover:bg-background border'
        }
      `}
      onClick={handleSearchInView}
      disabled={isSearching}
      title={t('map.searchInView.title')}
    >
      <MapPin className={`h-3 w-3 mr-1 ${isSearching ? 'animate-spin' : ''}`} />
      {isSearching ? t('map.searchInView.searching') : t('map.searchInView.button')}
    </Button>
  );
}