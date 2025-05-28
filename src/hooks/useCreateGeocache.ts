import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import type { CreateGeocacheData } from '@/types/geocache';

export function useCreateGeocache() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateGeocacheData) => {
      // Create the geocache event
      const content = JSON.stringify({
        name: data.name,
        description: data.description,
        hint: data.hint,
        location: data.location,
        difficulty: data.difficulty,
        terrain: data.terrain,
        size: data.size,
        type: data.type,
        images: data.images || [],
      });

      const event = await publishEvent({
        kind: 30078, // Application-specific data
        content,
        tags: [
          ['d', 'geocache'], // Identifier for geocache data
          ['name', data.name], // For easier searching
          ['g', getGeohash(data.location.lat, data.location.lng)], // Geohash for location-based queries
        ],
      });

      return event;
    },
    onSuccess: (event) => {
      toast({
        title: "Geocache created!",
        description: "Your geocache has been successfully hidden.",
      });
      
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      
      // Navigate to the new geocache
      navigate(`/cache/${event.id}`);
    },
    onError: (error) => {
      console.error('Failed to create geocache:', error);
      toast({
        title: "Failed to create geocache",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });
}

// Simple geohash implementation for location-based queries
function getGeohash(lat: number, lng: number, precision: number = 6): string {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      // longitude
      const mid = (lngMin + lngMax) / 2;
      if (lng > mid) {
        idx |= (1 << (4 - bit));
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      // latitude
      const mid = (latMin + latMax) / 2;
      if (lat > mid) {
        idx |= (1 << (4 - bit));
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    evenBit = !evenBit;

    if (bit < 4) {
      bit++;
    } else {
      geohash += base32[idx];
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}