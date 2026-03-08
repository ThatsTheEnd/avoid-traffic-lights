import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";

export interface LoadingStep {
  label: string;
  status: "pending" | "active" | "done";
  elapsed?: number; // ms
}

interface LoadingProgressProps {
  steps: LoadingStep[];
}

function formatTime(ms: number) {
  const s = ms / 1000;
  return s < 10 ? s.toFixed(1) + "s" : Math.round(s) + "s";
}

export default function LoadingProgress({ steps }: LoadingProgressProps) {
  const activeIndex = steps.findIndex((s) => s.status === "active");

  return (
    <div className="mx-5 my-3 rounded-xl bg-muted/60 border border-border p-4 flex flex-col gap-2.5 animate-fade-in">
      {steps.map((step, i) => (
        <StepRow key={i} step={step} isLast={i === steps.length - 1} />
      ))}
    </div>
  );
}

function StepRow({ step, isLast }: { step: LoadingStep; isLast: boolean }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (step.status !== "active") return;
    const start = Date.now();
    const id = setInterval(() => setTick(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [step.status]);

  const elapsed = step.status === "done" ? step.elapsed ?? 0 : step.status === "active" ? tick : 0;

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-5 h-5 flex items-center justify-center shrink-0">
        {step.status === "done" && (
          <Check className="w-4 h-4 text-primary" />
        )}
        {step.status === "active" && (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        )}
        {step.status === "pending" && (
          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
        )}
      </div>
      <span
        className={`text-xs flex-1 ${
          step.status === "done"
            ? "text-muted-foreground line-through"
            : step.status === "active"
            ? "text-foreground font-medium"
            : "text-muted-foreground/50"
        }`}
      >
        {step.label}
      </span>
      {(step.status === "active" || step.status === "done") && (
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums min-w-[3ch] text-right">
          {formatTime(elapsed)}
        </span>
      )}
    </div>
  );
}
