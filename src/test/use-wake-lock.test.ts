import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWakeLock } from "@/hooks/use-wake-lock";

describe("useWakeLock", () => {
  let mockRelease: ReturnType<typeof vi.fn>;
  let mockSentinel: Partial<WakeLockSentinel>;

  beforeEach(() => {
    mockRelease = vi.fn().mockResolvedValue(undefined);
    mockSentinel = {
      release: mockRelease,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      released: false,
      type: "screen",
      onrelease: null,
      dispatchEvent: vi.fn(),
    };

    Object.defineProperty(navigator, "wakeLock", {
      value: {
        request: vi.fn().mockResolvedValue(mockSentinel),
      },
      writable: true,
      configurable: true,
    });
  });

  it("reports supported when wakeLock API is available", () => {
    const { result } = renderHook(() => useWakeLock());
    expect(result.current.supported).toBe(true);
  });

  it("toggle requests wake lock when inactive", async () => {
    const { result } = renderHook(() => useWakeLock());
    expect(result.current.active).toBe(false);

    await act(async () => {
      await result.current.toggle();
    });

    expect(navigator.wakeLock.request).toHaveBeenCalledWith("screen");
    expect(result.current.active).toBe(true);
  });

  it("toggle releases wake lock when active", async () => {
    const { result } = renderHook(() => useWakeLock());

    // First toggle: activate
    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.active).toBe(true);

    // Second toggle: release
    await act(async () => {
      await result.current.toggle();
    });
    expect(mockRelease).toHaveBeenCalled();
    expect(result.current.active).toBe(false);
  });

  it("release() deactivates the lock", async () => {
    const { result } = renderHook(() => useWakeLock());

    await act(async () => {
      await result.current.toggle();
    });

    await act(async () => {
      await result.current.release();
    });

    expect(result.current.active).toBe(false);
    expect(mockRelease).toHaveBeenCalled();
  });
});
