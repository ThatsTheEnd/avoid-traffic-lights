import { describe, it, expect } from "vitest";
import {
  countTrafficLightsFromSignals,
  getRouteBoundingBox,
  mergeBoundingBoxes,
  clusterSignals,
} from "@/lib/api";
import type { TrafficLight } from "@/lib/api";

/**
 * Integration-style tests that exercise the full counting pipeline
 * (bbox → filter signals → cluster → count) without network calls.
 *
 * Fixture: Würenlos → Wettingen (~4km bike ride)
 * Real-world observation: the fewest-lights route has ~1 traffic light.
 */

// Simulated route coordinates for the "fewest lights" path (Würenlos→Wettingen via fields)
const fewestLightsRoute: [number, number][] = [
  [8.36181, 47.44211], // Würenlos
  [8.3580, 47.4440],
  [8.3530, 47.4470],
  [8.3470, 47.4510],
  [8.3410, 47.4550],
  [8.3370, 47.4590],
  [8.3330, 47.4620],
  [8.32661, 47.46584], // Wettingen
];

// Simulated "fastest" route through main road with more signals
const fastestRoute: [number, number][] = [
  [8.36181, 47.44211],
  [8.3550, 47.4430],
  [8.3480, 47.4450],
  [8.3400, 47.4480],
  [8.3350, 47.4510],
  [8.3300, 47.4560],
  [8.32661, 47.46584],
];

// Fixture: traffic signals in the Würenlos–Wettingen area
const areaSignals: TrafficLight[] = [
  // Intersection near Wettingen center (on both routes)
  { lat: 47.4600, lon: 8.3350 },
  { lat: 47.4601, lon: 8.3351 }, // clustered with above

  // Intersection on main road only (fastest route)
  { lat: 47.4450, lon: 8.3480 },
  { lat: 47.4451, lon: 8.3481 },

  // Another signal on main road
  { lat: 47.4510, lon: 8.3350 },

  // Signal far away (neither route)
  { lat: 47.5000, lon: 8.4000 },
  { lat: 47.4200, lon: 8.3900 },
];

describe("Würenlos → Wettingen integration", () => {
  it("fewest-lights route has fewer intersections than fastest route", () => {
    const fewest = countTrafficLightsFromSignals(fewestLightsRoute, areaSignals, 25);
    const fastest = countTrafficLightsFromSignals(fastestRoute, areaSignals, 25);

    // The fewest-lights route should have strictly fewer traffic lights
    expect(fewest.count).toBeLessThan(fastest.count);
  });

  it("fewest-lights route has at most 1 traffic light", () => {
    const result = countTrafficLightsFromSignals(fewestLightsRoute, areaSignals, 25);
    expect(result.count).toBeLessThanOrEqual(1);
  });

  it("'Fewest Lights' label is assigned to the route with minimum lights", () => {
    // Simulate the label-assignment logic from Index.tsx
    const routes = [
      { label: "Fastest", ...countTrafficLightsFromSignals(fastestRoute, areaSignals, 25) },
      { label: "Balanced", ...countTrafficLightsFromSignals(fewestLightsRoute, areaSignals, 25) },
    ];

    const fewestIdx = routes.reduce(
      (min, r, i) => (r.count < routes[min].count ? i : min),
      0
    );

    const labeled = routes.map((r, i) => ({
      ...r,
      label: i === fewestIdx ? "Fewest Lights" : r.label,
    }));

    const fewestLightsLabel = labeled.find((r) => r.label === "Fewest Lights");
    expect(fewestLightsLabel).toBeDefined();
    expect(fewestLightsLabel!.count).toBe(Math.min(...routes.map((r) => r.count)));
  });

  it("bounding boxes for both routes merge into a single encompassing box", () => {
    const bbox1 = getRouteBoundingBox(fewestLightsRoute);
    const bbox2 = getRouteBoundingBox(fastestRoute);
    const merged = mergeBoundingBoxes([bbox1, bbox2]);

    expect(merged.south).toBeLessThanOrEqual(47.44211 - 0.001);
    expect(merged.north).toBeGreaterThanOrEqual(47.46584 + 0.001);
  });
});
