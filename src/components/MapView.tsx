import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import {
  LngLatBounds,
  MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre v6 ships its web worker as a separate ES module and resolves it from
// `import.meta.url` at runtime, which a bundler cannot see - so the request 404s
// and every GeoJSON source silently stays empty (basemap renders, routes do not).
// Let Vite emit the worker as a real asset and point MapLibre at it explicitly.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
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

setWorkerUrl(maplibreWorkerUrl);

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: { type: "raster", tiles: [TILE_URL], tileSize: 256, attribution: "© OpenStreetMap contributors" },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
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
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupsRef = useRef<Popup[]>([]);
  const styleLoadedRef = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const pendingOpsRef = useRef<(() => void)[]>([]);

  // User location refs
  const userMarkerRef = useRef<Marker | null>(null);
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
    if (!containerRef.current) return;
    let resizeObserver: ResizeObserver | null = null;

    try {
      const map = new MapLibreMap({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [13.405, 52.52],
        zoom: 12,
      });

      map.addControl(new NavigationControl(), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        styleLoadedRef.current = true;
        map.resize();
        pendingOpsRef.current.forEach((fn) => fn());
        pendingOpsRef.current = [];
      });

      // Tile/style failures arrive as events rather than throws, so surface
      // them instead of leaving an unexplained blank canvas.
      map.on("error", (e) => {
        console.error("MapLibre error", e.error ?? e);
      });

      // Keep the canvas in sync whenever the container is resized (e.g. iOS
      // Safari layout shift when the browser chrome appears/disappears, or
      // the isMobile state updating after first render).
      resizeObserver = new ResizeObserver(() => {
        map.resize();
      });
      resizeObserver.observe(containerRef.current);
    } catch (err) {
      // e.g. WebGL2 unavailable (blocked/older browser) - MapLibre v6 throws
      // from the constructor in that case.
      console.error("Failed to initialise the map", err);
      setLoadError(true);
    }

    return () => {
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      styleLoadedRef.current = false;
      pendingOpsRef.current = [];
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

  const showRoute = (geojson: FeatureCollection, lights: TrafficLight[], highlight = false) => {
    whenReady(() => {
      const map = mapRef.current;
      if (!map) return;

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

          const popup = new Popup({ offset: 10, closeButton: false }).setHTML(
            "<span style='font-size:12px'>🚦 Traffic light</span>"
          );
          popupsRef.current.push(popup);

          const marker = new Marker({ element: el })
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
      if (!map) return;
      const bounds = new LngLatBounds();
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
      if (!map) return;

      // Create or update marker
      if (!userMarkerRef.current) {
        const el = createUserMarkerElement();
        userMarkerElRef.current = el;
        userMarkerRef.current = new Marker({ element: el, anchor: "center" })
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
        (map.getSource("user-accuracy") as GeoJSONSource | undefined)?.setData(accuracyGeoJSON);
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
      {loadError && (
        <div
          role="alert"
          className="absolute inset-0 flex items-center justify-center p-6 bg-background/95"
        >
          <div className="max-w-sm text-center space-y-2">
            <p className="font-semibold text-foreground">Map could not be loaded</p>
            <p className="text-sm text-muted-foreground">
              Your browser may not support WebGL2, or it is disabled. Routing still works, but the
              map cannot be displayed.
            </p>
          </div>
        </div>
      )}
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
