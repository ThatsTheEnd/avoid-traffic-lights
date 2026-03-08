import { useRef, useCallback, useEffect, MutableRefObject } from "react";
import { toast } from "sonner";

export interface LocationState {
  lat: number;
  lon: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
}

interface LocationButtonProps {
  onLocationStart: (lat: number, lon: number) => void;
  onLocationUpdate: (state: LocationState) => void;
  onLocationStop: () => void;
  trackingActive: boolean;
  setTrackingActive: (active: boolean) => void;
  startTrackingRef?: MutableRefObject<(() => void) | null>;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

export default function LocationButton({
  onLocationStart,
  onLocationUpdate,
  onLocationStop,
  trackingActive,
  setTrackingActive,
  startTrackingRef,
}: LocationButtonProps) {
  const watchIdRef = useRef<number | null>(null);
  const compassHeadingRef = useRef<number | null>(null);
  const orientationListenerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);
  const firstPositionRef = useRef(true);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (event.alpha !== null) {
      const heading = (event as any).webkitCompassHeading ?? event.alpha;
      compassHeadingRef.current = heading;
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (orientationListenerRef.current) {
      window.removeEventListener("deviceorientation", orientationListenerRef.current);
      orientationListenerRef.current = null;
    }
    compassHeadingRef.current = null;
    firstPositionRef.current = true;
    setTrackingActive(false);
    onLocationStop();
  }, [onLocationStop, setTrackingActive]);

  const startCompass = useCallback(async () => {
    if (isIOS()) {
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission === "function") {
        try {
          const response = await DOE.requestPermission();
          if (response === "granted") {
            orientationListenerRef.current = handleOrientation;
            window.addEventListener("deviceorientation", handleOrientation);
          } else {
            toast.error("Compass access denied. Direction cone unavailable.");
          }
        } catch {
          toast.error("Compass access denied. Direction cone unavailable.");
        }
      }
    } else {
      orientationListenerRef.current = handleOrientation;
      window.addEventListener("deviceorientation", handleOrientation);
    }
  }, [handleOrientation]);

  const startTracking = useCallback(() => {
    if (watchIdRef.current !== null) return; // already tracking

    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    if (!window.isSecureContext) {
      toast.error("Location requires a secure connection (HTTPS).");
      return;
    }

    firstPositionRef.current = true;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading: gpsHeading, accuracy, speed } = position.coords;

        const compassH = compassHeadingRef.current;
        let bestHeading: number | null = null;
        if (gpsHeading !== null && speed !== null && speed > 1.4) {
          bestHeading = gpsHeading;
        } else if (compassH !== null) {
          bestHeading = compassH;
        }

        const state: LocationState = { lat: latitude, lon: longitude, accuracy, heading: bestHeading, speed };
        onLocationUpdate(state);

        // Fire onLocationStart with the first position
        if (firstPositionRef.current) {
          firstPositionRef.current = false;
          onLocationStart(latitude, longitude);
        }
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("Location permission denied. Enter start address manually.");
            break;
          case error.TIMEOUT:
            toast.error("Could not get your location. Try again.");
            break;
          default:
            toast.error("Location unavailable: " + error.message);
        }
        stopTracking();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    watchIdRef.current = watchId;
    setTrackingActive(true);
    startCompass();
  }, [onLocationStart, onLocationUpdate, stopTracking, setTrackingActive, startCompass]);

  // Expose startTracking to parent
  useEffect(() => {
    if (startTrackingRef) {
      startTrackingRef.current = startTracking;
    }
  }, [startTracking, startTrackingRef]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (orientationListenerRef.current) {
        window.removeEventListener("deviceorientation", orientationListenerRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    if (trackingActive) {
      onLocationStart(0, 0); // re-center signal
      return;
    }
    startTracking();
  };

  return (
    <button
      onClick={handleClick}
      className={`absolute bottom-28 right-3 z-10 w-10 h-10 rounded-full shadow-lg border-2 flex items-center justify-center transition-all ${
        trackingActive
          ? "bg-primary border-primary text-primary-foreground"
          : "bg-card border-border text-foreground hover:bg-accent"
      }`}
      title={trackingActive ? "Re-center on location" : "Use my location"}
      aria-label="Use my location"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
      </svg>
    </button>
  );
}
