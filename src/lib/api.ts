import type { FeatureCollection, LineString } from "geojson";

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
  geojson: FeatureCollection;
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
      const geojson = await res.json() as FeatureCollection;
      const props = (geojson.features[0]?.properties || {}) as Record<string, number>;
      const distance = (props["track-length"] || 0) / 1000;
      const time = (props["total-time"] || 0) / 60;
      const geometry = geojson.features[0]?.geometry as LineString;
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

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function getRouteBoundingBox(coordinates: [number, number][], pad = 0.001): BoundingBox {
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;

  for (const [lng, lat] of coordinates) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }

  return {
    south: south - pad,
    west: west - pad,
    north: north + pad,
    east: east + pad,
  };
}

export function mergeBoundingBoxes(boxes: BoundingBox[]): BoundingBox {
  return boxes.reduce(
    (acc, box) => ({
      south: Math.min(acc.south, box.south),
      west: Math.min(acc.west, box.west),
      north: Math.max(acc.north, box.north),
      east: Math.max(acc.east, box.east),
    }),
    { south: Infinity, west: Infinity, north: -Infinity, east: -Infinity }
  );
}

export async function fetchTrafficSignalsInBoundingBox(bbox: BoundingBox): Promise<TrafficLight[]> {
  const query = `[out:json];node["highway"="traffic_signals"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});out body;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        return (data.elements || []).map((e: any) => ({ lat: e.lat, lon: e.lon }));
      }

      if (res.status === 429 || res.status >= 500) {
        await sleep(2500 * (attempt + 1));
        continue;
      }

      break;
    }
  }

  throw new Error("Overpass query failed (rate limited). Please try again in a moment.");
}

/** Cluster nearby signals into intersections (within `clusterRadius` meters) */
export function clusterSignals(
  signals: TrafficLight[],
  clusterRadius = 50
): TrafficLight[][] {
  const visited = new Set<number>();
  const clusters: TrafficLight[][] = [];

  for (let i = 0; i < signals.length; i++) {
    if (visited.has(i)) continue;
    visited.add(i);
    const cluster = [signals[i]];

    for (let j = i + 1; j < signals.length; j++) {
      if (visited.has(j)) continue;
      // Check distance to any member of the cluster
      const near = cluster.some(
        (c) => haversineDistance(c.lat, c.lon, signals[j].lat, signals[j].lon) <= clusterRadius
      );
      if (near) {
        visited.add(j);
        cluster.push(signals[j]);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

/** Return centroid of a cluster as a single representative TrafficLight */
function clusterCentroid(cluster: TrafficLight[]): TrafficLight {
  const lat = cluster.reduce((s, c) => s + c.lat, 0) / cluster.length;
  const lon = cluster.reduce((s, c) => s + c.lon, 0) / cluster.length;
  return { lat, lon };
}

export function countTrafficLightsFromSignals(
  coordinates: [number, number][],
  signals: TrafficLight[],
  thresholdMeters = 25
): { count: number; lights: TrafficLight[] } {
  if (coordinates.length === 0) return { count: 0, lights: [] };

  const matched = signals.filter((signal) =>
    isNearRoute(signal.lat, signal.lon, coordinates, thresholdMeters)
  );

  // Cluster nearby signals into intersections
  const clusters = clusterSignals(matched, 50);
  const centroids = clusters.map(clusterCentroid);

  return { count: centroids.length, lights: centroids };
}

export async function countTrafficLights(
  coordinates: [number, number][]
): Promise<{ count: number; lights: TrafficLight[] }> {
  if (coordinates.length === 0) return { count: 0, lights: [] };
  const bbox = getRouteBoundingBox(coordinates);
  const signals = await fetchTrafficSignalsInBoundingBox(bbox);
  return countTrafficLightsFromSignals(coordinates, signals, 25);
}

// Haversine distance in meters — exported for testing
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Check if a point is within `threshold` meters of any segment in the route — exported for testing
export function isNearRoute(
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

export function pointToSegmentDistance(
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
