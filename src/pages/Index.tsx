import { useState, useRef, useCallback } from "react";
import Sidebar, { RouteData } from "@/components/Sidebar";
import MapView, { MapViewHandle } from "@/components/MapView";
import LocationButton, { LocationState } from "@/components/LocationButton";
import { fetchRoutes, countTrafficLightsFromSignals, getRouteBoundingBox, mergeBoundingBoxes, fetchTrafficSignalsInBoundingBox } from "@/lib/api";
import { reverseGeocode } from "@/lib/reverseGeocode";

const Index = () => {
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRouteIndex, setActiveRouteIndex] = useState<number | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [locatingFromSidebar, setLocatingFromSidebar] = useState(false);
  const mapRef = useRef<MapViewHandle>(null);
  const lastLocationRef = useRef<{ lat: number; lon: number } | null>(null);
  const firstLocationRef = useRef(true);

  const [locationStartText, setLocationStartText] = useState<string | null>(null);
  const [locationStartCoord, setLocationStartCoord] = useState<{ lat: number; lon: number } | null>(null);

  // Ref to the LocationButton's startTracking trigger
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
      } catch (e: any) {
        setError(e.message || "Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const selectRoute = (routeList: RouteData[], index: number) => {
    const route = routeList[index];
    if (!route) return;
    mapRef.current?.clearAll();
    mapRef.current?.showRoute(route.geojson, route.lights);
    mapRef.current?.fitToRoute(route.coordinates);
    setActiveRouteIndex(index);
  };

  const handleSelectRoute = (index: number) => selectRoute(routes, index);

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

    // Always fill the start field when we get a location
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

  // Called from sidebar "Use current location" dropdown
  const handleUseCurrentLocation = useCallback(() => {
    if (trackingActive && lastLocationRef.current) {
      // Already tracking — just use last known position
      const { lat, lon } = lastLocationRef.current;
      handleLocationStart(lat, lon);
    } else {
      // Start tracking via LocationButton
      setLocatingFromSidebar(true);
      startTrackingRef.current?.();
    }
  }, [trackingActive, handleLocationStart]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
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
      </div>
    </div>
  );
};

export default Index;
