import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import type { TrafficLight } from "@/lib/api";
import type { FeatureCollection } from "geojson";
import type { LocationState } from "./LocationButton";

export interface MapViewHandle {
  showRoute: (geojson: FeatureCollection, lights: TrafficLight[], highlight?: boolean) => void;
  clearAll: () => void;
  fitToRoute: (coordinates: [number, number][]) => void;
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  updateUserLocation: (state: LocationState) => void;
  removeUserLocation: () => void;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    maplibregl?: any;
  }
}

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAPLIBRE_SCRIPT_ID = "maplibre-gl-cdn-script";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadMapLibre = async (): Promise<any> => {
  if (window.maplibregl) return window.maplibregl;

  const existing = document.getElementById(MAPLIBRE_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      if (window.maplibregl) { resolve(); return; }
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

/** Create the blue dot + direction cone SVG element */
function createUserMarkerElement(): HTMLDivElement {
  const container = document.createElement("div");
  container.style.width = "60px";
  container.style.height = "60px";
  container.style.position = "relative";
  container.className = "user-location-marker";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "60");
  svg.setAttribute("height", "60");
  svg.setAttribute("viewBox", "0 0 60 60");
  svg.style.position = "absolute";
  svg.style.top = "0";
  svg.style.left = "0";

  // Direction cone (pointing up = north, rotated via CSS)
  const cone = document.createElementNS("http://www.w3.org/2000/svg", "path");
  cone.setAttribute("d", "M30 4 L42 26 L18 26 Z");
  cone.setAttribute("fill", "rgba(59, 130, 246, 0.35)");
  cone.setAttribute("class", "direction-cone");
  cone.style.display = "none";
  svg.appendChild(cone);

  // Blue dot
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "30");
  circle.setAttribute("cy", "30");
  circle.setAttribute("r", "7");
  circle.setAttribute("fill", "#3B82F6");
  circle.setAttribute("stroke", "white");
  circle.setAttribute("stroke-width", "3");
  svg.appendChild(circle);

  container.appendChild(svg);
  return container;
}

function metersToPixels(meters: number, lat: number, zoom: number): number {
  const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  return meters / metersPerPixel;
}

const MapView = forwardRef<MapViewHandle>((_, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const popupsRef = useRef<any[]>([]);
  const styleLoadedRef = useRef(false);
  const pendingOpsRef = useRef<(() => void)[]>([]);

  // User location refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any | null>(null);
  const userMarkerElRef = useRef<HTMLDivElement | null>(null);
  const accuracySourceAdded = useRef(false);

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
            osm: { type: "raster", tiles: [TILE_URL], tileSize: 256, attribution: "© OpenStreetMap contributors" },
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
    return () => { disposed = true; mapRef.current?.remove(); };
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

  const showRoute = (geojson: FeatureCollection, lights: TrafficLight[], highlight = false) => {
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

  const flyTo = (lng: number, lat: number, zoom = 16) => {
    whenReady(() => {
      mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 800 });
    });
  };

  const updateUserLocation = (state: LocationState) => {
    whenReady(() => {
      const map = mapRef.current;
      const maplibregl = window.maplibregl;
      if (!map || !maplibregl) return;

      // Create or update marker
      if (!userMarkerRef.current) {
        const el = createUserMarkerElement();
        userMarkerElRef.current = el;
        userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([state.lon, state.lat])
          .addTo(map);
      } else {
        userMarkerRef.current.setLngLat([state.lon, state.lat]);
      }

      // Update direction cone
      const el = userMarkerElRef.current;
      if (el) {
        const cone = el.querySelector(".direction-cone") as SVGElement | null;
        if (cone) {
          if (state.heading !== null) {
            cone.style.display = "block";
            el.style.transform = `rotate(${state.heading}deg)`;
          } else {
            cone.style.display = "none";
            el.style.transform = "";
          }
        }
      }

      // Accuracy circle via GeoJSON source
      const accuracyGeoJSON = createAccuracyCircle(state.lat, state.lon, state.accuracy);
      if (!accuracySourceAdded.current) {
        map.addSource("user-accuracy", { type: "geojson", data: accuracyGeoJSON });
        map.addLayer({
          id: "user-accuracy",
          type: "fill",
          source: "user-accuracy",
          paint: {
            "fill-color": "#3B82F6",
            "fill-opacity": 0.12,
          },
        });
        accuracySourceAdded.current = true;
      } else {
        map.getSource("user-accuracy")?.setData(accuracyGeoJSON);
      }
    });
  };

  const removeUserLocation = () => {
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
      userMarkerElRef.current = null;
    }

    const map = mapRef.current;
    if (map && accuracySourceAdded.current) {
      if (map.getLayer("user-accuracy")) map.removeLayer("user-accuracy");
      if (map.getSource("user-accuracy")) map.removeSource("user-accuracy");
      accuracySourceAdded.current = false;
    }
  };

  useImperativeHandle(ref, () => ({ showRoute, clearAll, fitToRoute, flyTo, updateUserLocation, removeUserLocation }));

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-10 left-4 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md text-xs flex gap-3 items-center border border-border">
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

/** Generate a GeoJSON polygon approximating a circle */
function createAccuracyCircle(lat: number, lon: number, radiusMeters: number): Record<string, unknown> {
  const points = 36;
  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const dLat = dy / 111320;
    const dLon = dx / (111320 * Math.cos((lat * Math.PI) / 180));
    coords.push([lon + dLon, lat + dLat]);
  }
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [coords] },
    properties: {},
  };
}

MapView.displayName = "MapView";

export default MapView;
