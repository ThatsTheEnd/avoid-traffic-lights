import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RouteCard from "@/components/RouteCard";

const defaultProps = {
  label: "Fastest",
  lightCount: 5,
  time: 12.4,
  distance: 3.7,
  ascend: 120,
  descend: 85,
  isFewest: false,
  isActive: false,
  onSelect: vi.fn(),
  onHover: vi.fn(),
};

describe("RouteCard", () => {
  it("renders label, light count, time, and distance", () => {
    render(<RouteCard {...defaultProps} />);
    expect(screen.getByText("Fastest")).toBeInTheDocument();
    expect(screen.getByText(/🚦 5/)).toBeInTheDocument();
    expect(screen.getByText(/12 min/)).toBeInTheDocument();
    expect(screen.getByText(/3\.7 km/)).toBeInTheDocument();
  });

  it("shows 'Best' badge when isFewest is true", () => {
    render(<RouteCard {...defaultProps} isFewest />);
    expect(screen.getByText("Best")).toBeInTheDocument();
  });

  it("does NOT show 'Best' badge when isFewest is false", () => {
    render(<RouteCard {...defaultProps} isFewest={false} />);
    expect(screen.queryByText("Best")).not.toBeInTheDocument();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(<RouteCard {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("calls onHover with true/false on mouse enter/leave", () => {
    const onHover = vi.fn();
    render(<RouteCard {...defaultProps} onHover={onHover} />);
    const btn = screen.getByRole("button");
    fireEvent.mouseEnter(btn);
    expect(onHover).toHaveBeenCalledWith(true);
    fireEvent.mouseLeave(btn);
    expect(onHover).toHaveBeenCalledWith(false);
  });
});
