import { useState, useCallback, useEffect, useRef } from "react";

export function useWakeLock() {
  const [active, setActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const request = useCallback(async () => {
    if (!("wakeLock" in navigator)) return false;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      wakeLockRef.current.addEventListener("release", () => setActive(false));
      setActive(true);
      return true;
    } catch {
      setActive(false);
      return false;
    }
  }, []);

  const release = useCallback(async () => {
    await wakeLockRef.current?.release();
    wakeLockRef.current = null;
    setActive(false);
  }, []);

  const toggle = useCallback(async () => {
    if (active) await release();
    else await request();
  }, [active, request, release]);

  // Re-acquire on visibility change (browser releases it when tab is hidden)
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState === "visible" && active && !wakeLockRef.current) {
        await request();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [active, request]);

  // Cleanup on unmount
  useEffect(() => () => { wakeLockRef.current?.release(); }, []);

  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;

  return { active, toggle, release, supported };
}
