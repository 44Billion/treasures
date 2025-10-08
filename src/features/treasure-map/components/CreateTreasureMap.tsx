import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Plus, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useNostr } from '@nostrify/react';
import { buildTreasureMapTags } from '../utils/treasure-map-utils';
import { VALID_TREASURE_MAP_CATEGORIES, VALID_DIFFICULTY_LEVELS } from '../utils/treasure-map-utils';
import type { CreateTreasureMapData } from '../types/treasure-map';

// List of approved pubkeys that can create treasure maps
const APPROVED_TREASURE_MAP_CREATORS = [
  '86184109eae937d8d6f980b4a0b46da4ef0d983eade403ee1b4c0b6bde238b47', // chad (current user)
  // Add more approved pubkeys here
];

interface CreateTreasureMapProps {
  className?: string;
}

export function CreateTreasureMap({ className }: CreateTreasureMapProps) {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateTreasureMapData>({
    name: '',
    description: '',
    area: {
      center: { lat: 0, lng: 0 },
      radius: 5,
    },
    category: 'city',
    filters: {
      difficulty: { min: 1, max: 5 },
      terrain: { min: 1, max: 5 },
    },
    estimatedTime: '',
    difficulty: 'Moderate',
  });

  // Check if current user is approved to create treasure maps
  const isApprovedCreator = user && APPROVED_TREASURE_MAP_CREATORS.includes(user.pubkey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !isApprovedCreator) return;

    setIsSubmitting(true);

    try {
      // Generate dTag for replaceable event
      const dTag = `treasure-map-${Date.now()}`;

      // Build tags for treasure map event
      const tags = buildTreasureMapTags({
        ...formData,
        dTag,
      });

      // Create and publish event
      const event = await nostr.event({
        kind: 37520, // TREASURE_MAP_KIND
        tags,
        content: formData.description || '',
        created_at: Math.floor(Date.now() / 1000),
      });

      // Publish to relays
      await nostr.publish(event, {
        relays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'],
      });

      // Navigate back to treasure maps list
      navigate('/treasure-maps');
    } catch (error) {
      console.error('Error creating treasure map:', error);
      setIsSubmitting(false);
    }
  };

  const handleLocationChange = (lat: string, lng: string) => {
    setFormData(prev => ({
      ...prev,
      area: {
        ...prev.area,
        center: {
          lat: parseFloat(lat) || 0,
          lng: parseFloat(lng) || 0,
        },
      },
    }));
  };

  const handleRadiusChange = (radius: string) => {
    setFormData(prev => ({
      ...prev,
      area: {
        ...prev.area,
        radius: parseFloat(radius) || 5,
      },
    }));
  };

  if (!isApprovedCreator) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Create Treasure Map
            </CardTitle>
            <CardDescription>
              Only approved creators can create treasure maps. Contact an administrator to get approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🗺️</div>
              <h3 className="text-xl font-semibold mb-2">Approval Required</h3>
              <p className="text-muted-foreground">
                You need to be approved as a treasure map creator before you can submit new maps.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Create Treasure Map
          </CardTitle>
          <CardDescription>
            Create a new treasure map adventure for other geocachers to explore.
            Your map will be published immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              
              <div className="space-y-2">
                <Label htmlFor="name">Map Name</Label>
                <Input
                  id="name"
                  placeholder="Enter a catchy name for your treasure map..."
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what makes this treasure map special..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      category: value as CreateTreasureMapData['category'] 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {VALID_TREASURE_MAP_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <Select
                    value={formData.difficulty}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      difficulty: value as CreateTreasureMapData['difficulty'] 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      {VALID_DIFFICULTY_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedTime">Estimated Time</Label>
                <Input
                  id="estimatedTime"
                  placeholder="e.g., 2-3 hours, Half day, Full day"
                  value={formData.estimatedTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimatedTime: e.target.value }))}
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Location</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    placeholder="e.g., 40.7128"
                    value={formData.area.center?.lat || ''}
                    onChange={(e) => handleLocationChange(e.target.value, (formData.area.center?.lng || 0).toString())}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    placeholder="e.g., -74.0060"
                    value={formData.area.center?.lng || ''}
                    onChange={(e) => handleLocationChange((formData.area.center?.lat || 0).toString(), e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="radius">Search Radius (km)</Label>
                <Input
                  id="radius"
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  placeholder="e.g., 5"
                  value={formData.area.radius || ''}
                  onChange={(e) => handleRadiusChange(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Geocache Filters</h3>
              <p className="text-sm text-muted-foreground">
                Optionally set filters for the types of geocaches that should appear in this treasure map.
              </p>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Difficulty Range</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="diff-min">Min</Label>
                      <Select
                        value={formData.filters?.difficulty?.min?.toString() || '1'}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          filters: {
                            ...prev.filters!,
                            difficulty: {
                              ...prev.filters!.difficulty!,
                              min: parseInt(value),
                            },
                          },
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <SelectItem key={value} value={value.toString()}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diff-max">Max</Label>
                      <Select
                        value={formData.filters?.difficulty?.max?.toString() || '5'}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          filters: {
                            ...prev.filters!,
                            difficulty: {
                              ...prev.filters!.difficulty!,
                              max: parseInt(value),
                            },
                          },
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <SelectItem key={value} value={value.toString()}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Terrain Range</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="terrain-min">Min</Label>
                      <Select
                        value={formData.filters?.terrain?.min?.toString() || '1'}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          filters: {
                            ...prev.filters!,
                            terrain: {
                              ...prev.filters!.terrain!,
                              min: parseInt(value),
                            },
                          },
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <SelectItem key={value} value={value.toString()}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="terrain-max">Max</Label>
                      <Select
                        value={formData.filters?.terrain?.max?.toString() || '5'}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          filters: {
                            ...prev.filters!,
                            terrain: {
                              ...prev.filters!.terrain!,
                              max: parseInt(value),
                            },
                          },
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <SelectItem key={value} value={value.toString()}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/treasure-maps')}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Create Treasure Map'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}