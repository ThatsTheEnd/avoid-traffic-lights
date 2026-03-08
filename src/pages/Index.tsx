import { useState, useRef, useCallback } from "react";
import Sidebar, { RouteData } from "@/components/Sidebar";
import MapView, { MapViewHandle } from "@/components/MapView";
import LocationButton, { LocationState } from "@/components/LocationButton";
import { fetchRoutes, countTrafficLightsFromSignals, getRouteBoundingBox, mergeBoundingBoxes, fetchTrafficSignalsInBoundingBox } from "@/lib/api";
import { reverseGeocode } from "@/lib/reverseGeocode";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu, X } from "lucide-react";

const Index = () => {
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRouteIndex, setActiveRouteIndex] = useState<number | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [locatingFromSidebar, setLocatingFromSidebar] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const mapRef = useRef<MapViewHandle>(null);
  const lastLocationRef = useRef<{ lat: number; lon: number } | null>(null);
  const firstLocationRef = useRef(true);

  const [locationStartText, setLocationStartText] = useState<string | null>(null);
  const [locationStartCoord, setLocationStartCoord] = useState<{ lat: number; lon: number } | null>(null);

  const startTrackingRef = useRef<(() => void) | null>(null);

  const handleFindRoutes = useCallback(
    async (startLat: number, startLon: number, endLat: number, endLon: number) => {
      setLoading(true);
      setError(null);
      setRoutes([]);
      setActiveRouteIndex(null);
      mapRef.current?.clearAll();

      try {
        const rawRoutes = await fetchRoutes(startLat, startLon, endLat, endLon);
        const mergedBbox = mergeBoundingBoxes(
          rawRoutes.map((route) => getRouteBoundingBox(route.coordinates))
        );
        const allSignals = await fetchTrafficSignalsInBoundingBox(mergedBbox);

        const baseLabels = ["Fastest", "Balanced", "Alternative"];
        const withLightsRaw = rawRoutes.map((r, i) => {
          const { count, lights } = countTrafficLightsFromSignals(r.coordinates, allSignals);
          return { label: baseLabels[i], lightCount: count, time: r.time, distance: r.distance, geojson: r.geojson, coordinates: r.coordinates, lights };
        });

        const fewestIdx = withLightsRaw.reduce((min, r, i) => (r.lightCount < withLightsRaw[min].lightCount ? i : min), 0);
        const withLights: RouteData[] = withLightsRaw.map((r, i) => ({
          ...r,
          label: i === fewestIdx ? "Fewest Lights" : r.label,
        }));

        setRoutes(withLights);
        selectRoute(withLights, fewestIdx);
        if (isMobile) setSidebarOpen(false); // Auto-close on mobile after finding routes
      } catch (e: any) {
        setError(e.message || "Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [isMobile]
  );

  const selectRoute = (routeList: RouteData[], index: number) => {
    const route = routeList[index];
    if (!route) return;
    mapRef.current?.clearAll();
    mapRef.current?.showRoute(route.geojson, route.lights);
    mapRef.current?.fitToRoute(route.coordinates);
    setActiveRouteIndex(index);
  };

  const handleSelectRoute = (index: number) => {
    selectRoute(routes, index);
    if (isMobile) setSidebarOpen(false);
  };

  const handleHoverRoute = (index: number | null) => {
    if (index === null || index === activeRouteIndex) return;
    const route = routes[index];
    if (route) mapRef.current?.showRoute(route.geojson, route.lights, true);
  };

  const handleReset = () => {
    setRoutes([]);
    setActiveRouteIndex(null);
    setError(null);
    mapRef.current?.clearAll();
    mapRef.current?.removeUserLocation();
    setTrackingActive(false);
    setLocationStartText(null);
    setLocationStartCoord(null);
    setLocatingFromSidebar(false);
    firstLocationRef.current = true;
    lastLocationRef.current = null;
  };

  const handleLocationStart = useCallback(async (lat: number, lon: number) => {
    if (lat === 0 && lon === 0) {
      const last = lastLocationRef.current;
      if (last) mapRef.current?.flyTo(last.lon, last.lat, 16);
      return;
    }

    mapRef.current?.flyTo(lon, lat, 16);
    const displayName = await reverseGeocode(lat, lon);
    const name = displayName || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    setLocationStartText(name);
    setLocationStartCoord({ lat, lon });
    setLocatingFromSidebar(false);
    firstLocationRef.current = false;
  }, []);

  const handleLocationUpdate = useCallback((state: LocationState) => {
    lastLocationRef.current = { lat: state.lat, lon: state.lon };
    mapRef.current?.updateUserLocation(state);
  }, []);

  const handleLocationStop = useCallback(() => {
    mapRef.current?.removeUserLocation();
    lastLocationRef.current = null;
    firstLocationRef.current = true;
  }, []);

  const handleUseCurrentLocation = useCallback(() => {
    if (trackingActive && lastLocationRef.current) {
      const { lat, lon } = lastLocationRef.current;
      handleLocationStart(lat, lon);
    } else {
      setLocatingFromSidebar(true);
      startTrackingRef.current?.();
    }
  }, [trackingActive, handleLocationStart]);

  return (
    <div className="flex h-screen w-screen overflow-hidden relative">
      {/* Mobile menu button */}
      {isMobile && (
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-4 z-30 w-12 h-12 rounded-full bg-card shadow-lg border border-border flex items-center justify-center"
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      )}

      {/* Sidebar - slides in on mobile */}
      <div
        className={`
          ${isMobile ? "absolute inset-y-0 left-0 z-20 transform transition-transform duration-300 ease-in-out" : ""}
          ${isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"}
        `}
      >
        <Sidebar
          onFindRoutes={handleFindRoutes}
          routes={routes}
          loading={loading}
          error={error}
          activeRouteIndex={activeRouteIndex}
          onSelectRoute={handleSelectRoute}
          onHoverRoute={handleHoverRoute}
          onReset={handleReset}
          locationStartText={locationStartText}
          locationStartCoord={locationStartCoord}
          onUseCurrentLocation={handleUseCurrentLocation}
          locationLoading={locatingFromSidebar}
        />
      </div>

      {/* Overlay when sidebar is open on mobile */}
      {isMobile && sidebarOpen && (
        <div
          className="absolute inset-0 bg-black/40 z-10"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Map */}
      <div className="flex-1 h-full relative">
        <MapView ref={mapRef} />
        <LocationButton
          onLocationStart={handleLocationStart}
          onLocationUpdate={handleLocationUpdate}
          onLocationStop={handleLocationStop}
          trackingActive={trackingActive}
          setTrackingActive={setTrackingActive}
          startTrackingRef={startTrackingRef}
        />

        {/* Mobile route indicator pill */}
        {isMobile && routes.length > 0 && activeRouteIndex !== null && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-20 z-10 bg-card shadow-lg rounded-full px-4 py-2 flex items-center gap-2 border border-border"
          >
            <span className="text-xs font-medium text-foreground">
              {routes[activeRouteIndex].label}
            </span>
            <span className="text-xs text-muted-foreground">
              🚦 {routes[activeRouteIndex].lightCount}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Index;
