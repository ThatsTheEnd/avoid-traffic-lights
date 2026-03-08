import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoadingProgress from "@/components/LoadingProgress";
import type { LoadingStep } from "@/components/LoadingProgress";

describe("LoadingProgress", () => {
  it("renders all step labels", () => {
    const steps: LoadingStep[] = [
      { label: "Fetching routes…", status: "done", elapsed: 500 },
      { label: "Scanning lights…", status: "active" },
      { label: "Analysing…", status: "pending" },
    ];
    render(<LoadingProgress steps={steps} />);
    expect(screen.getByText("Fetching routes…")).toBeInTheDocument();
    expect(screen.getByText("Scanning lights…")).toBeInTheDocument();
    expect(screen.getByText("Analysing…")).toBeInTheDocument();
  });

  it("applies line-through style to done steps", () => {
    const steps: LoadingStep[] = [
      { label: "Done step", status: "done", elapsed: 100 },
      { label: "Active step", status: "active" },
    ];
    render(<LoadingProgress steps={steps} />);
    const doneEl = screen.getByText("Done step");
    expect(doneEl.className).toContain("line-through");
  });

  it("applies font-medium to active step", () => {
    const steps: LoadingStep[] = [
      { label: "Active step", status: "active" },
    ];
    render(<LoadingProgress steps={steps} />);
    const activeEl = screen.getByText("Active step");
    expect(activeEl.className).toContain("font-medium");
  });

  it("shows elapsed time for done steps", () => {
    const steps: LoadingStep[] = [
      { label: "Done", status: "done", elapsed: 1500 },
    ];
    render(<LoadingProgress steps={steps} />);
    expect(screen.getByText("1.5s")).toBeInTheDocument();
  });
});
