import type { RouteData } from "@/components/Sidebar";

/**
 * Converts a RouteData object to a GPX XML string.
 * GPX 1.1 is an open, widely compatible GPS exchange format supported by
 * Google Maps, Apple Maps, Garmin, Strava, Komoot, and most GPS devices/apps.
 */
export function routeToGpx(route: RouteData): string {
  const now = new Date().toISOString();
  const trkpts = route.coordinates
    .map(([lon, lat]) => `      <trkpt lat="${lat}" lon="${lon}"></trkpt>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GreenLight" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(route.label)}</name>
    <time>${now}</time>
  </metadata>
  <trk>
    <name>${escapeXml(route.label)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Exports a route as a GPX file.
 * On mobile devices that support the Web Share API with file sharing, the
 * native share sheet is used so the user can open the file directly in a
 * maps/cycling app. On all other platforms (desktop, or mobile without
 * file-share support) the file is downloaded via a standard <a> click.
 */
export async function exportRouteAsGpx(route: RouteData): Promise<void> {
  const gpxContent = routeToGpx(route);
  const filename = `greenlight-${route.label.toLowerCase().replace(/[\s/\\:*?"<>|]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}.gpx`;
  const blob = new Blob([gpxContent], { type: "application/gpx+xml" });

  // Try the Web Share API with file support first (Android Chrome, iOS Safari 15+)
  if (typeof navigator.canShare === "function") {
    const file = new File([blob], filename, { type: "application/gpx+xml" });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `GreenLight Route: ${route.label}`,
        files: [file],
      });
      return;
    }
  }

  // Fallback: standard browser download (works on all desktop browsers and
  // mobile browsers that do not support file sharing via the Share API)
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
