import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddressInput from "@/components/AddressInput";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mock geocode and reverseGeocode
vi.mock("@/lib/api", () => ({
  geocode: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/reverseGeocode", () => ({
  reverseGeocode: vi.fn().mockResolvedValue("Mocked Address, Zurich"),
}));

describe("AddressInput - Use Current Location", () => {
  const mockOnChange = vi.fn();
  const mockOnSelect = vi.fn();
  const mockOnUseCurrentLocation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Use current location' option when input is focused and showCurrentLocation is true", () => {
    render(
      <AddressInput
        placeholder="Start address or place"
        value=""
        onChange={mockOnChange}
        onSelect={mockOnSelect}
        showCurrentLocation
      />
    );

    const input = screen.getByPlaceholderText("Start address or place");
    fireEvent.focus(input);

    expect(screen.getByText("Use current location")).toBeInTheDocument();
  });

  it("does NOT show 'Use current location' when showCurrentLocation is false", () => {
    render(
      <AddressInput
        placeholder="Destination"
        value=""
        onChange={mockOnChange}
        onSelect={mockOnSelect}
        showCurrentLocation={false}
      />
    );

    const input = screen.getByPlaceholderText("Destination");
    fireEvent.focus(input);

    expect(screen.queryByText("Use current location")).not.toBeInTheDocument();
  });

  it("calls geolocation and fills address on success", async () => {
    const mockPosition = {
      coords: {
        latitude: 47.37,
        longitude: 8.54,
        accuracy: 10,
        heading: null,
        speed: null,
        altitude: null,
        altitudeAccuracy: null,
      },
      timestamp: Date.now(),
    };

    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => success(mockPosition)),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };
    Object.defineProperty(navigator, "geolocation", {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    render(
      <AddressInput
        placeholder="Start address or place"
        value=""
        onChange={mockOnChange}
        onSelect={mockOnSelect}
        showCurrentLocation
        onUseCurrentLocation={mockOnUseCurrentLocation}
      />
    );

    const input = screen.getByPlaceholderText("Start address or place");
    fireEvent.focus(input);

    const locationOption = screen.getByText("Use current location");
    fireEvent.mouseDown(locationOption);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith("Mocked Address, Zurich");
    });

    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: "47.37",
        lon: "8.54",
        display_name: "Mocked Address, Zurich",
      })
    );
    expect(mockOnUseCurrentLocation).toHaveBeenCalled();
  });

  it("shows error toast when geolocation permission is denied", async () => {
    const { toast } = await import("sonner");

    const mockGeolocation = {
      getCurrentPosition: vi.fn((_success, error) =>
        error({ code: 1, message: "User denied" })
      ),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };
    Object.defineProperty(navigator, "geolocation", {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    render(
      <AddressInput
        placeholder="Start address or place"
        value=""
        onChange={mockOnChange}
        onSelect={mockOnSelect}
        showCurrentLocation
      />
    );

    fireEvent.focus(screen.getByPlaceholderText("Start address or place"));
    fireEvent.mouseDown(screen.getByText("Use current location"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("permission denied")
      );
    });

    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it("shows error toast when geolocation times out", async () => {
    const { toast } = await import("sonner");

    const mockGeolocation = {
      getCurrentPosition: vi.fn((_success, error) =>
        error({ code: 3, message: "Timeout" })
      ),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };
    Object.defineProperty(navigator, "geolocation", {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    render(
      <AddressInput
        placeholder="Start address or place"
        value=""
        onChange={mockOnChange}
        onSelect={mockOnSelect}
        showCurrentLocation
      />
    );

    fireEvent.focus(screen.getByPlaceholderText("Start address or place"));
    fireEvent.mouseDown(screen.getByText("Use current location"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("timed out")
      );
    });
  });
});
