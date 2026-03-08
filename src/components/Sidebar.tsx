import { useState, useEffect } from "react";
import AddressInput from "./AddressInput";
import RouteCard from "./RouteCard";
import LoadingProgress from "./LoadingProgress";
import type { LoadingStep } from "./LoadingProgress";
import type { NominatimResult } from "@/lib/api";
import type { FeatureCollection } from "geojson";
import { Loader2, Share2 } from "lucide-react";

export interface RouteData {
  label: string;
  lightCount: number;
  time: number;
  distance: number;
  geojson: FeatureCollection;
  coordinates: [number, number][];
  lights: { lat: number; lon: number }[];
}

interface SidebarProps {
  onFindRoutes: (startLat: number, startLon: number, endLat: number, endLon: number) => void;
  routes: RouteData[];
  loading: boolean;
  error: string | null;
  activeRouteIndex: number | null;
  onSelectRoute: (index: number) => void;
  onHoverRoute: (index: number | null) => void;
  onReset: () => void;
  locationStartText?: string | null;
  locationStartCoord?: { lat: number; lon: number } | null;
  onUseCurrentLocation?: () => void;
  locationLoading?: boolean;
  onCopyLink?: () => void;
  loadingSteps?: LoadingStep[];
  sharedStartName?: string | null;
  sharedEndName?: string | null;
  sharedStartCoord?: { lat: number; lon: number } | null;
  sharedEndCoord?: { lat: number; lon: number } | null;
}

export default function Sidebar({
  onFindRoutes,
  routes,
  loading,
  error,
  activeRouteIndex,
  onSelectRoute,
  onHoverRoute,
  onReset,
  locationStartText,
  locationStartCoord,
  onUseCurrentLocation,
  locationLoading,
  onCopyLink,
  loadingSteps,
  sharedStartName,
  sharedEndName,
  sharedStartCoord,
  sharedEndCoord,
}: SidebarProps) {
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [startCoord, setStartCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [endCoord, setEndCoord] = useState<{ lat: number; lon: number } | null>(null);

  // Accept location from GPS / LocationButton
  useEffect(() => {
    if (locationStartText && locationStartCoord) {
      setStartText(locationStartText);
      setStartCoord(locationStartCoord);
    }
  }, [locationStartText, locationStartCoord]);

  // Accept shared route from URL
  useEffect(() => {
    if (sharedStartName && sharedStartCoord) {
      setStartText(sharedStartName);
      setStartCoord(sharedStartCoord);
    }
  }, [sharedStartName, sharedStartCoord]);

  useEffect(() => {
    if (sharedEndName && sharedEndCoord) {
      setEndText(sharedEndName);
      setEndCoord(sharedEndCoord);
    }
  }, [sharedEndName, sharedEndCoord]);

  const fewestIdx = routes.length
    ? routes.reduce((min, r, i) => (r.lightCount < routes[min].lightCount ? i : min), 0)
    : -1;

  const handleFind = () => {
    if (!startCoord || !endCoord) return;
    onFindRoutes(startCoord.lat, startCoord.lon, endCoord.lat, endCoord.lon);
  };

  const handleReset = () => {
    setStartText("");
    setEndText("");
    setStartCoord(null);
    setEndCoord(null);
    onReset();
  };

  return (
    <aside className="w-80 max-w-[85vw] shrink-0 h-screen overflow-y-auto bg-card panel-shadow flex flex-col z-10">
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-1.5">
            🚲 GreenLight
          </h1>
          <span className="text-[10px] text-muted-foreground font-mono">v0.1.14</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Find the route with fewest traffic lights
        </p>
      </div>

      <div className="p-5 flex flex-col gap-3">
        <AddressInput
          placeholder="Start address or place"
          value={startText}
          onChange={setStartText}
          onSelect={(r: NominatimResult) => setStartCoord({ lat: +r.lat, lon: +r.lon })}
          showCurrentLocation
          onUseCurrentLocation={onUseCurrentLocation}
          locationLoading={locationLoading}
        />
        <AddressInput
          placeholder="Destination address or place"
          value={endText}
          onChange={setEndText}
          onSelect={(r: NominatimResult) => setEndCoord({ lat: +r.lat, lon: +r.lon })}
        />
        <button
          onClick={handleFind}
          disabled={!startCoord || !endCoord || loading}
          className="w-full rounded-lg bg-primary text-primary-foreground font-semibold py-2.5 text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "Calculating..." : "Find Routes"}
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs">Calculating routes...</span>
        </div>
      )}

      {error && (
        <div className="mx-5 rounded-lg bg-destructive/10 text-destructive text-xs p-3">
          {error}
        </div>
      )}

      {!loading && routes.length > 0 && (
        <div className="p-5 flex flex-col gap-3">
          {routes.map((r, i) => (
            <RouteCard
              key={i}
              label={r.label}
              lightCount={r.lightCount}
              time={r.time}
              distance={r.distance}
              isFewest={i === fewestIdx}
              isActive={i === activeRouteIndex}
              onSelect={() => onSelectRoute(i)}
              onHover={(h) => onHoverRoute(h ? i : null)}
            />
          ))}
        </div>
      )}

      {routes.length > 0 && (
        <div className="p-5 pt-0 mt-auto flex flex-col gap-2">
          {onCopyLink && (
            <button
              onClick={onCopyLink}
              className="w-full rounded-lg bg-primary/10 text-primary text-xs py-2 hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5 font-medium"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share Route Link
            </button>
          )}
          <button
            onClick={handleReset}
            className="w-full rounded-lg border border-border text-muted-foreground text-xs py-2 hover:bg-muted transition-colors"
          >
            Reset
          </button>
        </div>
      )}
    </aside>
  );
}
