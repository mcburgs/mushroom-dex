import mushroomData from '../../data/mushrooms.json';
import { MushroomEntry } from '../types';

const INAT_TIMEOUT_MS = 6000;
const ONTARIO_PLACE_ID = 6986;

export interface InatObservation {
  id: number;
  taxonName: string;
  observedOn: string;
  imageUrl: string | null;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  dexMatch?: MushroomEntry;
  genusMatch?: boolean;
}

interface InatApiResult {
  id: number;
  observed_on_string?: string;
  observed_on?: string;
  location?: string;
  taxon?: {
    name?: string;
  };
  photos?: Array<{
    url?: string;
  }>;
  geojson?: {
    coordinates?: [number, number];
  };
}

interface InatResponse {
  results?: InatApiResult[];
}

const dexEntries = mushroomData as MushroomEntry[];

function toMediumPhoto(url?: string): string | null {
  if (!url) return null;
  return url.replace('square', 'medium');
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function matchDexEntry(taxonName: string): { dexMatch?: MushroomEntry; genusMatch?: boolean } {
  const normalized = taxonName.toLowerCase().trim();
  const exact = dexEntries.find(
    (entry) =>
      entry.scientificName.toLowerCase() === normalized ||
      entry.alternateNames.some((name) => name.toLowerCase() === normalized)
  );
  if (exact) return { dexMatch: exact, genusMatch: false };

  const genus = normalized.split(' ')[0];
  const genusMatch = dexEntries.find((entry) =>
    entry.scientificName.toLowerCase().startsWith(`${genus} `)
  );
  if (genusMatch) return { dexMatch: genusMatch, genusMatch: true };

  return {};
}

export async function fetchRecentSightings(userLocation?: { lat: number; lng: number }): Promise<InatObservation[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INAT_TIMEOUT_MS);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const d1 = thirtyDaysAgo.toISOString().slice(0, 10);

  const params = new URLSearchParams({
    taxon_name: 'Fungi',
    quality_grade: 'research',
    order: 'desc',
    order_by: 'observed_on',
    per_page: '20',
    d1,
    photos: 'true',
  });

  if (userLocation) {
    params.set('lat', String(userLocation.lat));
    params.set('lng', String(userLocation.lng));
    params.set('radius', '50');
  } else {
    params.set('place_id', String(ONTARIO_PLACE_ID));
  }

  try {
    const response = await fetch(`https://api.inaturalist.org/v1/observations?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`iNaturalist request failed: ${response.status}`);

    const payload = (await response.json()) as InatResponse;
    return (payload.results ?? []).map((result) => {
      const taxonName = result.taxon?.name ?? 'Unknown fungus';
      const [lng, lat] = result.geojson?.coordinates ?? [];
      const match = matchDexEntry(taxonName);
      return {
        id: result.id,
        taxonName,
        observedOn: result.observed_on_string ?? result.observed_on ?? '',
        imageUrl: toMediumPhoto(result.photos?.[0]?.url),
        latitude: lat,
        longitude: lng,
        distanceKm:
          userLocation && typeof lat === 'number' && typeof lng === 'number'
            ? haversineKm(userLocation.lat, userLocation.lng, lat, lng)
            : undefined,
        ...match,
      };
    });
  } finally {
    clearTimeout(timeout);
  }
}
