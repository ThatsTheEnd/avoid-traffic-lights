import { describe, it, expect } from "vitest";
import { haversineDistance, isNearRoute, pointToSegmentDistance } from "@/lib/api";

describe("haversineDistance", () => {
  it("returns 0 for the same point", () => {
    expect(haversineDistance(47.37, 8.54, 47.37, 8.54)).toBe(0);
  });

  it("calculates ~1km for known points in Zurich", () => {
    // Zurich HB to Bahnhofstrasse end (~700-800m)
    const dist = haversineDistance(47.3779, 8.5403, 47.3717, 8.5389);
    expect(dist).toBeGreaterThan(600);
    expect(dist).toBeLessThan(900);
  });

  it("calculates reasonable distance for far-apart cities", () => {
    // Zurich to Berlin (~670km)
    const dist = haversineDistance(47.37, 8.54, 52.52, 13.405);
    expect(dist).toBeGreaterThan(600_000);
    expect(dist).toBeLessThan(700_000);
  });
});

describe("pointToSegmentDistance", () => {
  it("returns 0 when point is on segment endpoint", () => {
    const dist = pointToSegmentDistance(47.37, 8.54, 47.37, 8.54, 47.38, 8.55);
    expect(dist).toBeLessThan(1);
  });

  it("returns small distance for point near segment", () => {
    // Point very close to a horizontal segment
    const dist = pointToSegmentDistance(
      47.3701, 8.545, // point slightly north
      47.37, 8.54,    // segment start
      47.37, 8.55     // segment end
    );
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(20); // should be ~11m
  });

  it("returns larger distance for point far from segment", () => {
    const dist = pointToSegmentDistance(
      47.38, 8.54,    // point 1km north
      47.37, 8.54,
      47.37, 8.55
    );
    expect(dist).toBeGreaterThan(1000);
  });
});

describe("isNearRoute", () => {
  const route: [number, number][] = [
    [8.54, 47.37],   // [lng, lat]
    [8.545, 47.37],
    [8.55, 47.37],
  ];

  it("returns true for a point on the route", () => {
    expect(isNearRoute(47.37, 8.543, route, 25)).toBe(true);
  });

  it("returns true for a point within 25m of the route", () => {
    // ~11m north of the route
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
