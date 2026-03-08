import { describe, it, expect } from "vitest";
import {
  haversineDistance,
  isNearRoute,
  pointToSegmentDistance,
  getRouteBoundingBox,
  mergeBoundingBoxes,
  clusterSignals,
  countTrafficLightsFromSignals,
} from "@/lib/api";
import type { TrafficLight } from "@/lib/api";

// ── haversineDistance ─────────────────────────────────────────────

describe("haversineDistance", () => {
  it("returns 0 for the same point", () => {
    expect(haversineDistance(47.37, 8.54, 47.37, 8.54)).toBe(0);
  });

  it("calculates ~700-800m for known points in Zurich", () => {
    const dist = haversineDistance(47.3779, 8.5403, 47.3717, 8.5389);
    expect(dist).toBeGreaterThan(600);
    expect(dist).toBeLessThan(900);
  });

  it("calculates ~670km for Zurich to Berlin", () => {
    const dist = haversineDistance(47.37, 8.54, 52.52, 13.405);
    expect(dist).toBeGreaterThan(600_000);
    expect(dist).toBeLessThan(700_000);
  });
});

// ── pointToSegmentDistance ────────────────────────────────────────

describe("pointToSegmentDistance", () => {
  it("returns 0 when point is on segment endpoint", () => {
    const dist = pointToSegmentDistance(47.37, 8.54, 47.37, 8.54, 47.38, 8.55);
    expect(dist).toBeLessThan(1);
  });

  it("returns small distance for point near segment", () => {
    const dist = pointToSegmentDistance(
      47.3701, 8.545,
      47.37, 8.54,
      47.37, 8.55
    );
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(20);
  });

  it("returns larger distance for point far from segment", () => {
    const dist = pointToSegmentDistance(47.38, 8.54, 47.37, 8.54, 47.37, 8.55);
    expect(dist).toBeGreaterThan(1000);
  });
});

// ── isNearRoute ──────────────────────────────────────────────────

describe("isNearRoute", () => {
  const route: [number, number][] = [
    [8.54, 47.37],
    [8.545, 47.37],
    [8.55, 47.37],
  ];

  it("returns true for a point on the route", () => {
    expect(isNearRoute(47.37, 8.543, route, 25)).toBe(true);
  });

  it("returns true for a point within 25m of the route", () => {
    expect(isNearRoute(47.3701, 8.545, route, 25)).toBe(true);
  });

  it("returns false for a point far from the route", () => {
    expect(isNearRoute(47.38, 8.54, route, 25)).toBe(false);
  });

  it("returns false for empty route", () => {
    expect(isNearRoute(47.37, 8.54, [], 25)).toBe(false);
  });

  it("returns false for single-point route", () => {
    expect(isNearRoute(47.37, 8.54, [[8.54, 47.37]], 25)).toBe(false);
  });
});

// ── getRouteBoundingBox ──────────────────────────────────────────

describe("getRouteBoundingBox", () => {
  it("returns correct bbox for known coordinates", () => {
    const coords: [number, number][] = [
      [8.36, 47.44],
      [8.33, 47.47],
    ];
    const bbox = getRouteBoundingBox(coords, 0);
    expect(bbox.south).toBeCloseTo(47.44);
    expect(bbox.north).toBeCloseTo(47.47);
    expect(bbox.west).toBeCloseTo(8.33);
    expect(bbox.east).toBeCloseTo(8.36);
  });

  it("applies padding correctly", () => {
    const coords: [number, number][] = [[8.5, 47.4]];
    const bbox = getRouteBoundingBox(coords, 0.01);
    expect(bbox.south).toBeCloseTo(47.39, 2);
    expect(bbox.north).toBeCloseTo(47.41, 2);
    expect(bbox.west).toBeCloseTo(8.49, 2);
    expect(bbox.east).toBeCloseTo(8.51, 2);
  });

  it("handles a single coordinate", () => {
    const coords: [number, number][] = [[8.5, 47.4]];
    const bbox = getRouteBoundingBox(coords, 0);
    expect(bbox.south).toBe(bbox.north);
    expect(bbox.west).toBe(bbox.east);
  });
});

// ── mergeBoundingBoxes ───────────────────────────────────────────

describe("mergeBoundingBoxes", () => {
  it("merges two non-overlapping boxes", () => {
    const merged = mergeBoundingBoxes([
      { south: 47.0, west: 8.0, north: 47.5, east: 8.5 },
      { south: 48.0, west: 9.0, north: 48.5, east: 9.5 },
    ]);
    expect(merged.south).toBe(47.0);
    expect(merged.north).toBe(48.5);
    expect(merged.west).toBe(8.0);
    expect(merged.east).toBe(9.5);
  });

  it("merges overlapping boxes", () => {
    const merged = mergeBoundingBoxes([
      { south: 47.0, west: 8.0, north: 47.5, east: 8.5 },
      { south: 47.3, west: 8.3, north: 47.8, east: 8.8 },
    ]);
    expect(merged.south).toBe(47.0);
    expect(merged.north).toBe(47.8);
    expect(merged.west).toBe(8.0);
    expect(merged.east).toBe(8.8);
  });

  it("handles a single box", () => {
    const box = { south: 47.0, west: 8.0, north: 47.5, east: 8.5 };
    const merged = mergeBoundingBoxes([box]);
    expect(merged).toEqual(box);
  });
});

// ── clusterSignals ───────────────────────────────────────────────

describe("clusterSignals", () => {
  it("groups nearby signals into one cluster", () => {
    const signals: TrafficLight[] = [
      { lat: 47.44, lon: 8.36 },
      { lat: 47.44001, lon: 8.36001 }, // ~1m away
    ];
    const clusters = clusterSignals(signals, 50);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(2);
  });

  it("keeps distant signals as separate clusters", () => {
    const signals: TrafficLight[] = [
      { lat: 47.44, lon: 8.36 },
      { lat: 47.45, lon: 8.37 }, // ~1.3km away
    ];
    const clusters = clusterSignals(signals, 50);
    expect(clusters).toHaveLength(2);
  });

  it("returns empty array for no signals", () => {
    expect(clusterSignals([], 50)).toEqual([]);
  });

  it("handles chain clustering (A near B, B near C → one cluster)", () => {
    // Three signals in a line, each ~30m apart
    const signals: TrafficLight[] = [
      { lat: 47.44, lon: 8.36 },
      { lat: 47.44, lon: 8.36004 }, // ~30m east
      { lat: 47.44, lon: 8.36008 }, // ~30m further east
    ];
    const clusters = clusterSignals(signals, 50);
    expect(clusters).toHaveLength(1);
  });
});

// ── countTrafficLightsFromSignals ────────────────────────────────

describe("countTrafficLightsFromSignals", () => {
  it("returns 0 for empty coordinates", () => {
    const result = countTrafficLightsFromSignals([], [{ lat: 47.44, lon: 8.36 }]);
    expect(result.count).toBe(0);
    expect(result.lights).toEqual([]);
  });

  it("returns 0 when no signals are near route", () => {
    const coords: [number, number][] = [
      [8.36, 47.44],
      [8.37, 47.44],
    ];
    const signals: TrafficLight[] = [
      { lat: 47.50, lon: 8.50 }, // far away
    ];
    const result = countTrafficLightsFromSignals(coords, signals, 25);
    expect(result.count).toBe(0);
  });

  it("counts a single intersection with multiple clustered signals as 1", () => {
    const coords: [number, number][] = [
      [8.36, 47.44],
      [8.37, 47.44],
    ];
    // Two signals at the same intersection (within 50m cluster radius)
    const signals: TrafficLight[] = [
      { lat: 47.44, lon: 8.365 },
      { lat: 47.44001, lon: 8.36501 },
    ];
    const result = countTrafficLightsFromSignals(coords, signals, 25);
    expect(result.count).toBe(1);
    expect(result.lights).toHaveLength(1);
  });

  it("counts two separate intersections correctly", () => {
    const coords: [number, number][] = [
      [8.36, 47.44],
      [8.37, 47.44],
      [8.38, 47.44],
    ];
    const signals: TrafficLight[] = [
      { lat: 47.44, lon: 8.365 },  // intersection 1
      { lat: 47.44, lon: 8.375 },  // intersection 2 (~740m away)
    ];
    const result = countTrafficLightsFromSignals(coords, signals, 25);
    expect(result.count).toBe(2);
  });

  // Regression: Würenlos→Wettingen fixture — the fewest-lights route should encounter ~1 traffic light
  it("Würenlos→Wettingen: route with fewest lights has very few intersections", () => {
    // Simplified route segment approximating the low-traffic-light path
    // The real route goes through fields/bike paths with minimal signals
    const coords: [number, number][] = [
      [8.36181, 47.44211],
      [8.355, 47.445],
      [8.345, 47.45],
      [8.335, 47.458],
      [8.32661, 47.46584],
    ];
    // Only one traffic signal near this route — placed exactly on a route vertex
    const signals: TrafficLight[] = [
      { lat: 47.445, lon: 8.355 },    // exactly at route point [8.355, 47.445]
      { lat: 47.500, lon: 8.500 },    // far away, not on route
      { lat: 47.430, lon: 8.380 },    // far away, not on route
    ];
    const result = countTrafficLightsFromSignals(coords, signals, 25);
    expect(result.count).toBe(1);
  });
});
