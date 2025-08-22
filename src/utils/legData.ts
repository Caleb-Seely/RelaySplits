/**
 * Centralized leg data for Hood to Coast relay race
 * Contains distances and locations for all 36 legs
 */

export interface LegLocation {
  name: string;
  address: string;
  description?: string;
}

export interface LegData {
  id: number;
  distance: number;
  location: LegLocation;
}

/**
 * Standard Hood to Coast relay race distances for all 36 legs (in miles).
 * These are the official distances used in the Hood to Coast relay race.
 */
export const LEG_DISTANCES = [
  6.26, 6.05, 4.08, 6.64, 6.05, 7.10, // Legs 1-6 (Van 1 first rotation)
  5.25, 6.00, 5.38, 6.15, 3.92, 5.85, // Legs 7-12 (Van 2 first rotation)
  5.21, 7.91, 6.00, 4.00, 5.32, 4.15, // Legs 13-18 (Van 1 second rotation)
  5.89, 5.58, 5.06, 6.82, 4.16, 4.83, // Legs 19-24 (Van 2 second rotation)
  3.80, 5.65, 6.36, 3.83, 5.97, 5.32, // Legs 25-30 (Van 1 final rotation)
  3.96, 4.20, 7.72, 4.12, 7.07, 5.03  // Legs 31-36 (Van 2 final rotation)
];

/**
 * Hood to Coast exchange points and leg locations
 * Each leg maps to its specific location
 */
export const LEG_LOCATIONS: Record<number, LegLocation> = {
  // Van 1 First Rotation
  1: {
    name: 'Timberline Lodge',
    address: '45.3309549, -121.7155129',
    description: 'Race Start'
  },
  2: {
    name: 'Government Camp',
    address: '45.304771, -121.759188',
    description: 'Leg 2 Exchange'
  },
  3: {
    name: 'IDK',
    address: '45.307884, -121.854509',
    description: 'Leg 3 Exchange'
  },
  4: {
    name: 'IDK',
    address: '45.334985, -121.918987',
    description: 'Leg 4 Exchange'
  },
  5: {
    name: 'IDK',
    address: '45.377700, -122.039235',
    description: 'Leg 5 Exchange'
  },
  6: {
    name: 'IDK',
    address: '45.366529, -122.155008',
    description: 'Leg 6 Exchange'
  },
  // Van 2 First Rotation
  7: {
    name: 'Sandy High School',
    address: '45.405721, -122.276866',
    description: 'Van Switch 1'
  },  
  8: {
    name: 'IDK',
    address: '45.453705, -122.290537',
    description: 'Leg 8 Exchange'
  },
  9: {
    name: 'Boring Trail Start',
    address: '45.432170, -122.375395',
    description: 'Leg 9 Exchange'
  },
  10: {
    name: 'Boring Trail',
    address: '45.495413, -122.431662',
    description: 'Leg 10 Exchange'
  },
  11: {
    name: 'Boring Trail',
    address: '45.478160, -122.548594',
    description: 'Leg 11 Exchange'
  },
  12: {
    name: 'Springwater',
    address: '45.461816, -122.617121',
    description: 'Leg 12 Exchange'
  },
  // Van 1 Second Rotation
  13: {
    name: 'OMSI',
    address: '45.506717, -122.664303',
    description: 'Van Switch 2'
  },
  14: {
    name: 'IDK',
    address: '45.551924, -122.715139',
    description: 'Leg 14 Exchange'
  },
  15: {
    name: 'Sauvies',
    address: '45.629822, -122.815850',
    description: 'Leg 15 Exchange'
  },
  16: {
    name: 'IDK',
    address: '45.694970, -122.871008',
    description: 'Leg 16 Exchange'
  },
  17: {
    name: 'IDK',
    address: '45.749198, -122.874359',
    description: 'Leg 17 Exchange'
  },
  18: {
    name: 'IDK',
    address: '45.819164, -122.850781',
    description: 'Leg 18 Exchange'
  },
  // Van 2 Second Rotation
  19: {
    name: 'Columbi County Fair',
    address: '45.850550, -122.872306',
    description: 'Van Switch 3'
  },
  20: {
    name: 'IDK',
    address: '45.901569, -122.933970',
    description: 'Leg 20 Exchange'
  },
  21: {
    name: 'IDK',
    address: '45.890793, -122.997456',
    description: 'Leg 21 Exchange'
  },
  22: {
    name: 'IDK',
    address: '45.945578, -123.043629',
    description: 'Leg 22 Exchange'
  },
  23: {
    name: 'IDK',
    address: '45.949276, -123.149365',
    description: 'Leg 23 Exchange'
  },
  24: {
    name: 'IDK',
    address: '45.974329, -123.198666',
    description: 'Leg 24 Exchange'
  },
  // Van 1 Final Rotation
  25: {
    name: 'Major EX Field',
    address: '46.002792, -123.278399',
    description: 'Van Switch 4'
  },
  26: {
    name: 'IDK',
    address: '45.995729, -123.334103',
    description: 'Leg 26 Exchange'
  },
  27: {
    name: 'IDK',
    address: '45.975560, -123.416774',
    description: 'Leg 27 Exchange'
  },
  28: {
    name: 'IDK',
    address: '45.933928, -123.506100',
    description: 'Leg 28 Exchange'
  },
  29: {
    name: 'IDK',
    address: '45.954195, -123.573884',
    description: 'Leg 29 Exchange'
  },
  30: {
    name: 'IDK',
    address: '46.020736, -123.625101',
    description: 'Leg 30 Exchange'
  },
  // Van 2 Final Rotation
  31: {
    name: 'Major EX Field 2',
    address: '46.065768, -123.692707',
    description: 'Van Switch 5'
  },
  32: {
    name: 'IDK',
    address: '46.097719, -123.749397',
    description: 'Leg 32 Exchange'
  },
  33: {
    name: 'IDK',
    address: '46.069758, -123.787865',
    description: 'Leg 33 Exchange'
  },
  34: {
    name: 'IDK',
    address: '46.147492, -123.846048',
    description: 'Leg 34 Exchange'
  },
  35: {
    name: 'IDK',
    address: '46.104487, -123.866126',
    description: 'Leg 35 Exchange'
  },
  36: {
    name: 'Final Leg Start',
    address: '46.007615, -123.867294',
    description: 'Leg 36 Exchange'
  },
  37: {
    name: 'Seaside Beach',
    address: '45.993835, -123.930111',
    description: 'Race Finish'
  }
};


/**
 * Major van exchange points where teams swap between Van 1 and Van 2.
 * These are the leg numbers where major handoffs occur in a relay race.
 */
export const MAJOR_EXCHANGES = [7, 13, 19, 25, 31, 37];

/**
 * Get the distance for a specific leg
 */
export function getLegDistance(legId: number): number {
  return LEG_DISTANCES[legId - 1] || 0;
}

/**
 * Get the location data for a specific leg
 */
export function getLegLocation(legId: number): LegLocation | null {
  return LEG_LOCATIONS[legId] || null;
}

/**
 * Get Google Maps directions URL for a specific leg
 */
export function getLegDirectionsUrl(legId: number): string {
  const location = getLegLocation(legId);
  if (!location) {
    // Fallback to general Hood to Coast directions
    return 'https://maps.google.com/maps?daddr=Seaside+Beach+Seaside+OR';
  }

  // Check if the address is coordinates (contains comma and numbers)
  if (location.address.includes(',') && /\d+\.\d+/.test(location.address)) {
    // Use coordinates format for Google Maps
    return `https://maps.google.com/maps?daddr=${location.address}`;
  }

  // Encode the destination for URL (for text addresses)
  const encodedDestination = encodeURIComponent(location.address);
  return `https://maps.google.com/maps?daddr=${encodedDestination}`;
}

/**
 * Get all leg data for a specific leg
 */
export function getLegData(legId: number): LegData | null {
  const distance = getLegDistance(legId);
  const location = getLegLocation(legId);
  
  if (!location) return null;
  
  return {
    id: legId,
    distance,
    location
  };
}
