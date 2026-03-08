// Nominatim geocoding
export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export async function geocode(query: string): Promise<NominatimResult[]> {
  if (!query || query.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en" },
  });
  if (!res.ok) throw new Error("Geocoding failed");
  return res.json();
}

// BRouter routing
export interface RouteResult {
  label: string;
  geojson: GeoJSON.FeatureCollection;
  distance: number; // km
  time: number; // minutes
  coordinates: [number, number][]; // [lng, lat]
}

const BROUTER_PROFILES: { profile: string; altIdx: number; label: string }[] = [
  { profile: "fastbike", altIdx: 0, label: "Fastest" },
  { profile: "trekking", altIdx: 0, label: "Balanced" },
  { profile: "trekking", altIdx: 1, label: "Fewest Lights" },
];

export async function fetchRoutes(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): Promise<RouteResult[]> {
  const results = await Promise.all(
    BROUTER_PROFILES.map(async ({ profile, altIdx, label }) => {
      const url = `https://brouter.de/brouter?lonlats=${startLon},${startLat}|${endLon},${endLat}&profile=${profile}&alternativeidx=${altIdx}&format=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Routing failed for ${label}`);
      const geojson = await res.json() as GeoJSON.FeatureCollection;
      const props = geojson.features[0]?.properties || {};
      const distance = (props["track-length"] || 0) / 1000;
      const time = (props["total-time"] || 0) / 60;
      const geometry = geojson.features[0]?.geometry as GeoJSON.LineString;
      const coordinates = (geometry?.coordinates || []) as [number, number][];
      return { label, geojson, distance, time, coordinates };
    })
  );
  return results;
}

// Overpass traffic lights
export interface TrafficLight {
  lat: number;
  lon: number;
}

export async function countTrafficLights(
  coordinates: [number, number][]
): Promise<{ count: number; lights: TrafficLight[] }> {
  if (coordinates.length === 0) return { count: 0, lights: [] };

  // Compute bounding box [minLon, minLat, maxLon, maxLat]
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
  for (const [lng, lat] of coordinates) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }

  // Small padding
  const pad = 0.001;
  south -= pad; west -= pad; north += pad; east += pad;

  const query = `[out:json];node["highway"="traffic_signals"](${south},${west},${north},${east});out body;`;
  
  // Retry logic for Overpass rate limiting
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    if (res.ok) break;
    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  if (!res || !res.ok) throw new Error("Overpass query failed (rate limited). Please try again in a moment.");
  const data = await res.json();
  const allSignals: TrafficLight[] = (data.elements || []).map((e: any) => ({
    lat: e.lat,
    lon: e.lon,
  }));

  // Filter: only signals within 25m of the route
  const matched = allSignals.filter((signal) =>
    isNearRoute(signal.lat, signal.lon, coordinates, 25)
  );

  return { count: matched.length, lights: matched };
}

// Haversine distance in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Check if a point is within `threshold` meters of any segment in the route
function isNearRoute(
  lat: number,
  lon: number,
  coords: [number, number][],
  threshold: number
): boolean {
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    const dist = pointToSegmentDistance(lat, lon, lat1, lng1, lat2, lng2);
    if (dist <= threshold) return true;
  }
  return false;
}

function pointToSegmentDistance(
  pLat: number, pLon: number,
  aLat: number, aLon: number,
  bLat: number, bLon: number
): number {
  const dA = haversineDistance(pLat, pLon, aLat, aLon);
  const dB = haversineDistance(pLat, pLon, bLat, bLon);
  const dAB = haversineDistance(aLat, aLon, bLat, bLon);
  if (dAB === 0) return dA;

  // Project point onto segment
  const t = Math.max(0, Math.min(1,
    ((pLat - aLat) * (bLat - aLat) + (pLon - aLon) * (bLon - aLon)) /
    ((bLat - aLat) ** 2 + (bLon - aLon) ** 2)
  ));
  const projLat = aLat + t * (bLat - aLat);
  const projLon = aLon + t * (bLon - aLon);
  return haversineDistance(pLat, pLon, projLat, projLon);
}
