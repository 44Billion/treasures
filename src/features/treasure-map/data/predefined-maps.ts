import { PredefinedTreasureMap } from '../types/treasure-map';

export const PREDEFINED_TREASURE_MAPS: PredefinedTreasureMap[] = [
  {
    id: 'central-park-nyc',
    name: 'Central Park Quest',
    description: 'Discover hidden treasures throughout New York\'s iconic Central Park. This adventure takes you through meadows, around lakes, and past famous landmarks.',
    area: {
      center: {
        lat: 40.7829,
        lng: -73.9654
      },
      radius: 2.5
    },
    theme: 'adventure',
    category: 'park',
    created_at: Date.now(),
    creator: 'treasures',
    estimatedTime: '3-4 hours',
    difficulty: 'Moderate',
    filters: {
      types: ['traditional', 'multi'],
      difficulty: { min: 1, max: 4 },
      terrain: { min: 1, max: 3 }
    }
  },
  {
    id: 'golden-gate-park',
    name: 'Golden Gate Expedition',
    description: 'Explore the vast Golden Gate Park in San Francisco and uncover geocaches hidden among gardens, museums, and scenic trails.',
    area: {
      center: {
        lat: 37.7694,
        lng: -122.4862
      },
      radius: 3
    },
    theme: 'adventure',
    category: 'park',
    created_at: Date.now(),
    creator: 'treasures',
    estimatedTime: '4-5 hours',
    difficulty: 'Moderate to Challenging',
    filters: {
      types: ['traditional', 'mystery'],
      difficulty: { min: 2, max: 5 },
      terrain: { min: 2, max: 4 }
    }
  },
  {
    id: 'london-parks',
    name: 'Royal Parks Adventure',
    description: 'A majestic journey through London\'s Royal Parks, from Hyde Park to Regent\'s Park, discovering treasures in the heart of the city.',
    area: {
      bounds: {
        northEast: { lat: 51.5364, lng: -0.1419 },
        southWest: { lat: 51.4876, lng: -0.1920 }
      }
    },
    theme: 'adventure',
    category: 'city',
    created_at: Date.now(),
    creator: 'treasures',
    estimatedTime: 'Full day',
    difficulty: 'Challenging',
    filters: {
      types: ['traditional', 'multi', 'mystery'],
      difficulty: { min: 1, max: 5 },
      terrain: { min: 1, max: 3 }
    }
  },
  {
    id: 'tokyo-imperial-palace',
    name: 'Imperial Palace Treasure Hunt',
    description: 'Seek out hidden caches around the historic Imperial Palace in Tokyo, blending ancient history with modern geocaching.',
    area: {
      center: {
        lat: 35.6852,
        lng: 139.7528
      },
      radius: 2
    },
    theme: 'adventure',
    category: 'landmark',
    created_at: Date.now(),
    creator: 'treasures',
    estimatedTime: '2-3 hours',
    difficulty: 'Easy to Moderate',
    filters: {
      types: ['traditional'],
      difficulty: { min: 1, max: 3 },
      terrain: { min: 1, max: 2 }
    }
  },
  {
    id: 'paris-marais',
    name: 'Le Marais Mystery',
    description: 'Wander through the historic streets of Le Marais in Paris, solving puzzles and finding caches in this charming medieval district.',
    area: {
      center: {
        lat: 48.8576,
        lng: 2.3602
      },
      radius: 1.5
    },
    theme: 'adventure',
    category: 'city',
    created_at: Date.now(),
    creator: 'treasures',
    estimatedTime: '2-3 hours',
    difficulty: 'Moderate',
    filters: {
      types: ['traditional', 'mystery'],
      difficulty: { min: 2, max: 4 },
      terrain: { min: 1, max: 2 }
    }
  },
  {
    id: 'sydney-harbour',
    name: 'Sydney Harbour Quest',
    description: 'An epic adventure around Sydney Harbour, from the Opera House to the Harbour Bridge, with breathtaking views and hidden treasures.',
    area: {
      center: {
        lat: -33.8568,
        lng: 151.2153
      },
      radius: 4
    },
    theme: 'adventure',
    category: 'landmark',
    created_at: Date.now(),
    creator: 'treasures',
    estimatedTime: '4-6 hours',
    difficulty: 'Challenging',
    filters: {
      types: ['traditional', 'multi'],
      difficulty: { min: 2, max: 5 },
      terrain: { min: 2, max: 5 }
    }
  }
];

export const TREASURE_MAP_CATEGORIES = [
  { value: 'city', label: 'City Adventure', icon: '🏙️' },
  { value: 'park', label: 'Park Expedition', icon: '🌳' },
  { value: 'region', label: 'Regional Quest', icon: '🗺️' },
  { value: 'trail', label: 'Trail Journey', icon: '🥾' },
  { value: 'landmark', label: 'Landmark Hunt', icon: '🏛️' }
] as const;