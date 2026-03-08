import { describe, it, expect, vi, beforeEach } from "vitest";
import { reverseGeocode } from "@/lib/reverseGeocode";

describe("reverseGeocode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns display_name on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ display_name: "Zurich, Switzerland" }),
    } as Response);

    const result = await reverseGeocode(47.37, 8.54);
    expect(result).toBe("Zurich, Switzerland");
  });

  it("returns null on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));
    const result = await reverseGeocode(47.37, 8.54);
    expect(result).toBeNull();
  });

  it("returns null on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
    } as Response);
    const result = await reverseGeocode(47.37, 8.54);
    expect(result).toBeNull();
  });

  it("returns null when display_name is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);
    const result = await reverseGeocode(47.37, 8.54);
    expect(result).toBeNull();
  });
});
