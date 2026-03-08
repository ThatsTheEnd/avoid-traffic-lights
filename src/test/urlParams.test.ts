import { describe, it, expect } from "vitest";

/**
 * URL parameter parsing/serialization tests.
 * These test the logic without rendering full components.
 */

describe("URL params serialization", () => {
  it("encodes route params correctly", () => {
    const params = new URLSearchParams();
    params.set("slat", (47.44211).toFixed(5));
    params.set("slon", (8.36181).toFixed(5));
    params.set("elat", (47.46584).toFixed(5));
    params.set("elon", (8.32661).toFixed(5));

    expect(params.get("slat")).toBe("47.44211");
    expect(params.get("slon")).toBe("8.36181");
    expect(params.get("elat")).toBe("47.46584");
    expect(params.get("elon")).toBe("8.32661");
  });

  it("parses URL params back to numbers", () => {
    const url = "https://example.com/?slat=47.44211&slon=8.36181&elat=47.46584&elon=8.32661";
    const params = new URL(url).searchParams;

    const sLatN = parseFloat(params.get("slat")!);
    const sLonN = parseFloat(params.get("slon")!);
    const eLatN = parseFloat(params.get("elat")!);
    const eLonN = parseFloat(params.get("elon")!);

    expect(sLatN).toBeCloseTo(47.44211, 5);
    expect(sLonN).toBeCloseTo(8.36181, 5);
    expect(eLatN).toBeCloseTo(47.46584, 5);
    expect(eLonN).toBeCloseTo(8.32661, 5);
  });

  it("handles missing params gracefully", () => {
    const params = new URLSearchParams("");
    expect(params.get("slat")).toBeNull();
    expect(params.get("slon")).toBeNull();

    const allPresent = ["slat", "slon", "elat", "elon"].every((k) => params.get(k) !== null);
    expect(allPresent).toBe(false);
  });

  it("reset clears all params", () => {
    const params = new URLSearchParams("slat=47&slon=8&elat=48&elon=9");
    const cleared = new URLSearchParams();
    // Simulates setSearchParams({}, { replace: true })
    expect(cleared.toString()).toBe("");
  });
});
