interface RouteCardProps {
  label: string;
  lightCount: number;
  time: number;
  distance: number;
  ascend: number;
  descend: number;
  isFewest: boolean;
  isActive: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
}

export default function RouteCard({
  label,
  lightCount,
  time,
  distance,
  ascend,
  descend,
  isFewest,
  isActive,
  onSelect,
  onHover,
}: RouteCardProps) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`w-full rounded-xl border-2 p-4 text-left transition-all duration-200 ${
        isActive
          ? "border-primary bg-primary/5 shadow-md"
          : isFewest
          ? "border-primary/50 bg-secondary"
          : "border-border bg-card hover:border-primary/30"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {isFewest && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            Best
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground mb-3">
        🚦 {lightCount}
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
        <span>🕒 {Math.round(time)} min</span>
        <span>📏 {distance.toFixed(1)} km</span>
        <span>⬆ {Math.round(ascend)} m</span>
        <span>⬇ {Math.round(descend)} m</span>
      </div>
    </button>
  );
}
