import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AddressInput from "@/components/AddressInput";

vi.mock("@/lib/api", () => ({
  geocode: vi.fn().mockResolvedValue([]),
}));

describe("AddressInput - Use Current Location", () => {
  const mockOnChange = vi.fn();
  const mockOnSelect = vi.fn();
  const mockOnUseCurrentLocation = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it("shows 'Use current location' when focused and showCurrentLocation is true", () => {
    render(
      <AddressInput placeholder="Start" value="" onChange={mockOnChange} onSelect={mockOnSelect} showCurrentLocation />
    );
    fireEvent.focus(screen.getByPlaceholderText("Start"));
    expect(screen.getByText("Use current location")).toBeInTheDocument();
  });

  it("does NOT show option when showCurrentLocation is false", () => {
    render(
      <AddressInput placeholder="Dest" value="" onChange={mockOnChange} onSelect={mockOnSelect} />
    );
    fireEvent.focus(screen.getByPlaceholderText("Dest"));
    expect(screen.queryByText("Use current location")).not.toBeInTheDocument();
  });

  it("calls onUseCurrentLocation callback when clicked", () => {
    render(
      <AddressInput
        placeholder="Start"
        value=""
        onChange={mockOnChange}
        onSelect={mockOnSelect}
        showCurrentLocation
        onUseCurrentLocation={mockOnUseCurrentLocation}
      />
    );
    fireEvent.focus(screen.getByPlaceholderText("Start"));
    fireEvent.mouseDown(screen.getByText("Use current location"));
    expect(mockOnUseCurrentLocation).toHaveBeenCalledOnce();
  });

  it("shows loading state when locationLoading is true", () => {
    render(
      <AddressInput
        placeholder="Start"
        value=""
        onChange={mockOnChange}
        onSelect={mockOnSelect}
        showCurrentLocation
        locationLoading
      />
    );
    expect(screen.getByDisplayValue("Getting location...")).toBeInTheDocument();
  });
});
