import { useState, useRef, useCallback } from "react";
import Sidebar, { RouteData } from "@/components/Sidebar";
import MapView, { MapViewHandle } from "@/components/MapView";
import { fetchRoutes, countTrafficLightsFromSignals, getRouteBoundingBox, mergeBoundingBoxes, fetchTrafficSignalsInBoundingBox } from "@/lib/api";

const Index = () => {
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRouteIndex, setActiveRouteIndex] = useState<number | null>(null);
  const mapRef = useRef<MapViewHandle>(null);

  const handleFindRoutes = useCallback(
    async (startLat: number, startLon: number, endLat: number, endLon: number) => {
      setLoading(true);
      setError(null);
      setRoutes([]);
      setActiveRouteIndex(null);
      mapRef.current?.clearAll();

      try {
        const rawRoutes = await fetchRoutes(startLat, startLon, endLat, endLon);

        // Single Overpass query for all routes to avoid rate limits
        const mergedBbox = mergeBoundingBoxes(
          rawRoutes.map((route) => getRouteBoundingBox(route.coordinates))
        );
        const allSignals = await fetchTrafficSignalsInBoundingBox(mergedBbox);

        const baseLabels = ["Fastest", "Balanced", "Alternative"];
        const withLightsRaw = rawRoutes.map((r, i) => {
          const { count, lights } = countTrafficLightsFromSignals(r.coordinates, allSignals);
          return {
            label: baseLabels[i],
            lightCount: count,
            time: r.time,
            distance: r.distance,
            geojson: r.geojson,
            coordinates: r.coordinates,
            lights,
          };
        });

        // Dynamically assign "Fewest Lights" label to the route with the lowest count
        const fewestIdx = withLightsRaw.reduce(
          (min, r, i) => (r.lightCount < withLightsRaw[min].lightCount ? i : min),
          0
        );
        const withLights: RouteData[] = withLightsRaw.map((r, i) => ({
          ...r,
          label: i === fewestIdx ? "Fewest Lights" : r.label,
        }));

        setRoutes(withLights);

        // Auto-select fewest lights route
        const fewestIdx = withLights.reduce(
          (min, r, i) => (r.lightCount < withLights[min].lightCount ? i : min),
          0
        );
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

  const handleSelectRoute = (index: number) => {
    selectRoute(routes, index);
  };

  const handleHoverRoute = (index: number | null) => {
    if (index === null || index === activeRouteIndex) {
      // Remove highlight layer if exists
      return;
    }
    const route = routes[index];
    if (route) {
      mapRef.current?.showRoute(route.geojson, route.lights, true);
    }
  };

  const handleReset = () => {
    setRoutes([]);
    setActiveRouteIndex(null);
    setError(null);
    mapRef.current?.clearAll();
  };

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
      />
      <div className="flex-1 h-full">
        <MapView ref={mapRef} />
      </div>
    </div>
  );
};

export default Index;
