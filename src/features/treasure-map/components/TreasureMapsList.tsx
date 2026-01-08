import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Building2, TreePine, Map, Route, Landmark } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTreasureMaps } from '../hooks/useTreasureMaps';
import { TreasureMapCard } from './TreasureMapCard';
import { VALID_TREASURE_MAP_CATEGORIES } from '../utils/treasure-map-utils';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';

// Category info with icons and labels
const CATEGORY_INFO = {
  city: { icon: Building2, label: 'City Adventure' },
  park: { icon: TreePine, label: 'Park Expedition' },
  region: { icon: Map, label: 'Regional Quest' },
  trail: { icon: Route, label: 'Trail Journey' },
  landmark: { icon: Landmark, label: 'Landmark Hunt' },
} as const;

import type { TreasureMap } from '../types/treasure-map';

interface TreasureMapsListProps {
  className?: string;
}

export function TreasureMapsList({ className }: TreasureMapsListProps) {
  const navigate = useNavigate();
  const { treasureMaps, isLoading } = useTreasureMaps();
  const { user } = useCurrentUser();

  // Check if current user is approved to create treasure maps
  const isApprovedCreator = user && [
    '86184109eae937d8d6f980b4a0b46da4ef0d983eade403ee1b4c0b6bde238b47', // chad (current user)
    // Add more approved pubkeys here
  ].includes(user.pubkey);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Filter treasure maps based on search and category
  const filteredMaps = treasureMaps.filter((map) => {
    const matchesSearch = !searchQuery ||
      map.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      map.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || map.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Group maps by category
  const mapsByCategory = filteredMaps.reduce((acc, map) => {
    if (!acc[map.category]) {
      acc[map.category] = [];
    }
    acc[map.category].push(map);
    return acc;
  }, {} as Record<string, TreasureMap[]>);

  const handleMapClick = (mapId: string) => {
    navigate(`/treasure-maps/${mapId}`);
  };

  if (isLoading) {
    return (
      <div className={className}>
        <div className="space-y-4">
          {/* Search skeleton */}
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>

          {/* Category filters skeleton */}
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
            ))}
          </div>

          {/* Map cards skeleton */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Treasure Maps</h1>
          <p className="text-muted-foreground">
            Embark on epic adventures with curated treasure maps from around the world
          </p>
        </div>

        {/* Create button for approved users */}
        {isApprovedCreator && (
          <div className="flex justify-center">
            <Button
              onClick={() => navigate('/treasure-maps/create')}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Treasure Map
            </Button>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="space-y-4 mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search treasure maps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
          >
            All Maps
          </Button>
          {VALID_TREASURE_MAP_CATEGORIES.map((category) => {
            const IconComponent = CATEGORY_INFO[category].icon;
            return (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="flex items-center gap-1"
              >
                <IconComponent className="h-3 w-3" />
                <span>{CATEGORY_INFO[category].label}</span>
                {mapsByCategory[category] && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {mapsByCategory[category].length}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {filteredMaps.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-xl font-semibold mb-2">No treasure maps found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || selectedCategory !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Check back soon for new treasure map adventures!'
            }
          </p>
          {(searchQuery || selectedCategory !== 'all') && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Group by category */}
          {selectedCategory === 'all' ? (
            // Show all maps grouped by category
            Object.entries(mapsByCategory).map(([category, maps]) => {
              const categoryInfo = CATEGORY_INFO[category];
              if (!categoryInfo || maps.length === 0) return null;

              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <categoryInfo.icon className="h-5 w-5" /> {categoryInfo.label}
                    </h2>
                    <Badge variant="secondary">{maps.length} maps</Badge>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {maps.map((map) => (
                      <TreasureMapCard
                        key={map.id}
                        treasureMap={map}
                        onClick={() => handleMapClick(map.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            // Show maps from selected category only
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMaps.map((map) => (
                <TreasureMapCard
                  key={map.id}
                  treasureMap={map}
                  onClick={() => handleMapClick(map.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}