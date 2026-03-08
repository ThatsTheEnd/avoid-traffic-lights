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

        // Count traffic lights for all routes in parallel
        // Sequence Overpass calls to avoid rate limiting
        const withLights: RouteData[] = [];
        for (const r of rawRoutes) {
          const { count, lights } = await countTrafficLights(r.coordinates);
          withLights.push({
            label: r.label,
            lightCount: count,
            time: r.time,
            distance: r.distance,
            geojson: r.geojson,
            coordinates: r.coordinates,
            lights,
          });
        }

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
