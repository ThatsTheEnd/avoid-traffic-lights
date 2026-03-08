import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "@/components/Sidebar";

vi.mock("@/lib/api", () => ({
  geocode: vi.fn().mockResolvedValue([]),
}));

const defaultProps = {
  onFindRoutes: vi.fn(),
  routes: [],
  loading: false,
  error: null,
  activeRouteIndex: null,
  onSelectRoute: vi.fn(),
  onHoverRoute: vi.fn(),
  onReset: vi.fn(),
};

describe("Sidebar", () => {
  it("Find Routes button is disabled when no coords selected", () => {
    render(<Sidebar {...defaultProps} />);
    const btn = screen.getByText("Find Routes");
    expect(btn).toBeDisabled();
  });

  it("shows error message when error prop is set", () => {
    render(<Sidebar {...defaultProps} error="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows loading text when loading", () => {
    render(<Sidebar {...defaultProps} loading />);
    expect(screen.getByText("Calculating...")).toBeInTheDocument();
  });

  it("Reset button calls onReset and clears inputs", () => {
    const onReset = vi.fn();
    const routes = [
      {
        label: "Fewest Lights",
        lightCount: 1,
        time: 10,
        distance: 3,
        geojson: { type: "FeatureCollection" as const, features: [] },
        coordinates: [[8.36, 47.44]] as [number, number][],
        lights: [],
        ascend: 50,
        descend: 30,
      },
    ];
    render(<Sidebar {...defaultProps} routes={routes} activeRouteIndex={0} onReset={onReset} />);
    fireEvent.click(screen.getByText("Reset"));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("Share button is visible only when routes exist and onCopyLink provided", () => {
    const { rerender } = render(<Sidebar {...defaultProps} />);
    expect(screen.queryByText("Share Route Link")).not.toBeInTheDocument();

    const routes = [
      {
        label: "Fastest",
        lightCount: 3,
        time: 10,
        distance: 3,
        geojson: { type: "FeatureCollection" as const, features: [] },
        coordinates: [] as [number, number][],
        lights: [],
      },
    ];
    rerender(<Sidebar {...defaultProps} routes={routes} activeRouteIndex={0} onCopyLink={vi.fn()} />);
    expect(screen.getByText("Share Route Link")).toBeInTheDocument();
  });

  it("renders route cards when routes are provided", () => {
    const routes = [
      {
        label: "Fastest",
        lightCount: 5,
        time: 12,
        distance: 4.2,
        geojson: { type: "FeatureCollection" as const, features: [] },
        coordinates: [] as [number, number][],
        lights: [],
      },
      {
        label: "Fewest Lights",
        lightCount: 1,
        time: 15,
        distance: 5.1,
        geojson: { type: "FeatureCollection" as const, features: [] },
        coordinates: [] as [number, number][],
        lights: [],
      },
    ];
    render(<Sidebar {...defaultProps} routes={routes} activeRouteIndex={0} />);
    expect(screen.getByText("Fastest")).toBeInTheDocument();
    expect(screen.getByText("Fewest Lights")).toBeInTheDocument();
  });
});
