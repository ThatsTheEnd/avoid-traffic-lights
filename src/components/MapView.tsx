import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import type { TrafficLight } from "@/lib/api";
import type { FeatureCollection } from "geojson";

export interface MapViewHandle {
  showRoute: (geojson: FeatureCollection, lights: TrafficLight[], highlight?: boolean) => void;
  clearAll: () => void;
  fitToRoute: (coordinates: [number, number][]) => void;
}

declare global {
  interface Window {
    maplibregl?: any;
  }
}

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const MAPLIBRE_SCRIPT_ID = "maplibre-gl-cdn-script";

const loadMapLibre = async (): Promise<any> => {
  if (window.maplibregl) return window.maplibregl;

  const existing = document.getElementById(MAPLIBRE_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      if (window.maplibregl) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load MapLibre script")), { once: true });
    });
    return window.maplibregl;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = MAPLIBRE_SCRIPT_ID;
    script.src = "https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load MapLibre script"));
    document.head.appendChild(script);
  });

  return window.maplibregl;
};

const MapView = forwardRef<MapViewHandle>((_, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any | null>(null);
  const markersRef = useRef<any[]>([]);
  const popupsRef = useRef<any[]>([]);
  const styleLoadedRef = useRef(false);
  const pendingOpsRef = useRef<(() => void)[]>([]);

  const whenReady = (fn: () => void) => {
    if (styleLoadedRef.current && mapRef.current) {
      fn();
    } else {
      pendingOpsRef.current.push(fn);
    }
  };

  useEffect(() => {
    let disposed = false;

    const initMap = async () => {
      if (!containerRef.current) return;
      const maplibregl = await loadMapLibre();
      if (!maplibregl || disposed || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: [TILE_URL],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: [13.405, 52.52],
        zoom: 12,
      });

      map.addControl(new maplibregl.NavigationControl(), "top-right");
      mapRef.current = map;
      map.on("load", () => {
        styleLoadedRef.current = true;
        pendingOpsRef.current.forEach((fn) => fn());
        pendingOpsRef.current = [];
      });
    };

    initMap();

    return () => {
      disposed = true;
      mapRef.current?.remove();
    };
  }, []);

  const clearAll = () => {
    const map = mapRef.current;
    if (!map) return;

    ["route-line", "route-line-highlight"].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];
  };

  const showRoute = (
    geojson: FeatureCollection,
    lights: TrafficLight[],
    highlight = false
  ) => {
    whenReady(() => {
      const map = mapRef.current;
      const maplibregl = window.maplibregl;
      if (!map || !maplibregl) return;

      const sourceId = highlight ? "route-line-highlight" : "route-line";

      if (map.getLayer(sourceId)) map.removeLayer(sourceId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      if (!highlight) {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        popupsRef.current.forEach((p) => p.remove());
        popupsRef.current = [];
      }

      map.addSource(sourceId, { type: "geojson", data: geojson });
      map.addLayer({
        id: sourceId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": highlight ? "#81b29a" : "#2d6a4f",
          "line-width": highlight ? 4 : 5,
          "line-opacity": highlight ? 0.5 : 1,
        },
      });

      if (!highlight) {
        lights.forEach((light) => {
          const el = document.createElement("div");
          el.style.width = "12px";
          el.style.height = "12px";
          el.style.borderRadius = "50%";
          el.style.backgroundColor = "#e63946";
          el.style.border = "2px solid white";
          el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.3)";
          el.style.cursor = "pointer";

          const popup = new maplibregl.Popup({ offset: 10, closeButton: false }).setHTML(
            "<span style='font-size:12px'>🚦 Traffic light</span>"
          );
          popupsRef.current.push(popup);

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([light.lon, light.lat])
            .setPopup(popup)
            .addTo(map);

          el.addEventListener("mouseenter", () => popup.addTo(map));
          el.addEventListener("mouseleave", () => popup.remove());

          markersRef.current.push(marker);
        });
      }
    });
  };

  const fitToRoute = (coordinates: [number, number][]) => {
    if (coordinates.length === 0) return;

    whenReady(() => {
      const map = mapRef.current;
      const maplibregl = window.maplibregl;
      if (!map || !maplibregl) return;

      const bounds = new maplibregl.LngLatBounds();
      coordinates.forEach(([lng, lat]) => bounds.extend([lng, lat]));
      map.fitBounds(bounds, { padding: 60, duration: 800 });
    });
  };

  useImperativeHandle(ref, () => ({ showRoute, clearAll, fitToRoute }));

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md text-xs flex gap-3 items-center border border-border">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-1 rounded-full bg-primary" />
          Route
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-traffic-light" />
          Traffic light
        </span>
      </div>
    </div>
  );
});

MapView.displayName = "MapView";

export default MapView;
