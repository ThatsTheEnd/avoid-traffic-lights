import { useState, useEffect, useRef, useCallback } from "react";
import { geocode, NominatimResult } from "@/lib/api";
import { MapPin } from "lucide-react";

interface AddressInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: NominatimResult) => void;
  showCurrentLocation?: boolean;
  onUseCurrentLocation?: () => void;
  locationLoading?: boolean;
}

export default function AddressInput({
  placeholder,
  value,
  onChange,
  onSelect,
  showCurrentLocation,
  onUseCurrentLocation,
  locationLoading,
}: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback((q: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        const results = await geocode(q);
        setSuggestions(results);
        setOpen(results.length > 0 || (showCurrentLocation === true && q.length === 0));
      } catch {
        setSuggestions([]);
      }
    }, 400);
  }, [showCurrentLocation]);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
        placeholder={placeholder}
        value={locationLoading ? "Getting location..." : value}
        disabled={locationLoading}
        onChange={(e) => {
          onChange(e.target.value);
          doSearch(e.target.value);
        }}
        onFocus={() => {
          if (suggestions.length > 0 || showCurrentLocation) setOpen(true);
        }}
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden">
          {showCurrentLocation && (
            <li
              className="cursor-pointer px-3 py-2.5 text-xs text-foreground hover:bg-accent transition-colors flex items-center gap-2 border-b border-border"
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                onUseCurrentLocation?.();
              }}
            >
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="font-medium">Use current location</span>
            </li>
          )}
          {suggestions.map((s) => (
            <li
              key={s.place_id}
              className="cursor-pointer px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors truncate"
              onClick={() => {
                onSelect(s);
                onChange(s.display_name);
                setOpen(false);
              }}
            >
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
