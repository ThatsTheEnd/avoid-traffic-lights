import { describe, it, expect } from "vitest";
import { routeToGpx } from "@/lib/exportGpx";
import type { RouteData } from "@/components/Sidebar";

const sampleRoute: RouteData = {
  label: "Fewest Lights",
  lightCount: 2,
  time: 15,
  distance: 3.5,
  ascend: 20,
  descend: 15,
  geojson: { type: "FeatureCollection", features: [] },
  coordinates: [
    [8.54, 47.37],
    [8.545, 47.372],
    [8.55, 47.375],
  ],
  lights: [],
};

describe("routeToGpx", () => {
  it("returns a valid GPX XML string", () => {
    const gpx = routeToGpx(sampleRoute);
    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx).toContain("http://www.topografix.com/GPX/1/1");
  });

  it("includes the route label as track name", () => {
    const gpx = routeToGpx(sampleRoute);
    expect(gpx).toContain("<name>Fewest Lights</name>");
  });

  it("includes all track points with correct lat/lon", () => {
    const gpx = routeToGpx(sampleRoute);
    expect(gpx).toContain('lat="47.37" lon="8.54"');
    expect(gpx).toContain('lat="47.372" lon="8.545"');
    expect(gpx).toContain('lat="47.375" lon="8.55"');
  });

  it("wraps track points in <trkseg> inside <trk>", () => {
    const gpx = routeToGpx(sampleRoute);
    expect(gpx).toContain("<trk>");
    expect(gpx).toContain("<trkseg>");
    expect(gpx).toContain("</trkseg>");
    expect(gpx).toContain("</trk>");
  });

  it("includes a <metadata> block with <time>", () => {
    const gpx = routeToGpx(sampleRoute);
    expect(gpx).toContain("<metadata>");
    expect(gpx).toContain("<time>");
  });

  it("escapes XML special characters in the route label", () => {
    const routeWithSpecialChars: RouteData = {
      ...sampleRoute,
      label: 'Route <A> & "B"',
    };
    const gpx = routeToGpx(routeWithSpecialChars);
    expect(gpx).toContain("Route &lt;A&gt; &amp; &quot;B&quot;");
    expect(gpx).not.toContain("<A>");
  });

  it("handles an empty coordinates array", () => {
    const emptyRoute: RouteData = { ...sampleRoute, coordinates: [] };
    const gpx = routeToGpx(emptyRoute);
    expect(gpx).toContain("<trkseg>");
    expect(gpx).not.toContain("<trkpt");
  });

  it("produces a filename-safe label from a normal label", () => {
    const label = "Fewest Lights";
    const filename = `greenlight-${label.toLowerCase().replace(/[\s/\\:*?"<>|]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}.gpx`;
    expect(filename).toBe("greenlight-fewest-lights.gpx");
  });

  it("removes filesystem-unsafe characters from the filename", () => {
    const unsafeLabel = 'Route/A:B*C?"<D>|E';
    const filename = `greenlight-${unsafeLabel.toLowerCase().replace(/[\s/\\:*?"<>|]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}.gpx`;
    expect(filename).toBe("greenlight-route-a-b-c-d-e.gpx");
  });
});
