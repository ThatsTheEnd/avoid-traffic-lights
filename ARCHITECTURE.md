# GreenLight — Project Summary & Architecture

## What this app is

GreenLight is a browser-based cycling route planner with one specific purpose: **minimizing traffic lights on bike commutes**. The core insight is that for urban cyclists, traffic lights are the primary source of frustration and delay — not distance. A route that is 500m longer but has 5 fewer red lights is almost always faster and more enjoyable in practice.

No equivalent app exists. Existing cycling apps (Komoot, Bikemap, CycleStreets, Google Maps) optimize for quietness, speed, or scenery — none of them surface traffic light count as a first-class metric visible to the user. GreenLight makes it the central number.

---

## What the app does

The user enters a start point and a destination. The app returns **3 route options**, each showing:
- 🚦 Number of traffic lights
- 🕒 Estimated travel time
- 📏 Distance in km
- ⬆️ Elevation gain / ⬇️ Elevation loss

The three routes are labeled **Fastest**, **Balanced**, and **Fewest Lights**. The Fewest Lights route is visually highlighted. When a route is selected, it draws on the map with red dot markers at each traffic light location along the route.

The user's live location is shown as a blue dot with a directional cone that rotates based on movement direction (GPS heading while cycling) or compass direction (when stationary).

---

## Architecture — front-end only

This app has **no backend server**. All logic runs in the browser. All APIs used are free and require no API keys. This means hosting costs are zero.

### Why no backend?
The three data sources needed (routing, traffic lights, geocoding) are all available as free public APIs that support direct browser calls via CORS. A backend would only be needed later if rate limits become a problem due to high user traffic.

### APIs used

**BRouter** — routing engine
- Free, no API key
- Returns GeoJSON routes for cyclists using OpenStreetMap data
- Three profiles used: `fastbike` (fastest route), `trekking` (balanced), `trekking` alternative index 1 (fewest lights approximation)
- Each coordinate in the response is `[longitude, latitude, elevation_meters]` — elevation is built in, no separate API call needed
- URL pattern: `https://brouter.de/brouter?lonlat={lon},{lat}|{lon},{lat}&profile=fastbike&alternativeidx=0&format=geojson`

**Overpass API** — traffic light locations
- Free, no API key
- Queries OpenStreetMap nodes tagged `highway=traffic_signals` within the bounding box of each route
- After fetching, each signal node is checked against the route polyline using a point-to-segment Haversine distance function — only nodes within 25 meters of the route are counted
- URL pattern: `https://overpass-api.de/api/interpreter?data=[out:json];node["highway"="traffic_signals"]({south},{west},{north},{east});out body;`

**Nominatim** — geocoding and reverse geocoding
- Free, no API key
- Used for address autocomplete in the Start and Destination fields (forward geocoding)
- Used to fill the Start field with a human-readable address when the user taps "Use my location" (reverse geocoding)
- Forward: `https://nominatim.openstreetmap.org/search?q={input}&format=json&limit=5`
- Reverse: `https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json`

**MapLibre GL JS** — map rendering
- Free, open source (no Mapbox account needed)
- Renders the map, routes, and markers in the browser using WebGL
- Basemap tiles from OpenStreetMap (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`)

---

## Elevation data

Elevation comes free inside every BRouter response. The third value of each coordinate is altitude in meters. Elevation gain and loss are calculated by iterating through consecutive coordinates and summing positive and negative differences. No separate elevation API is needed.

---

## Live location and compass direction

Uses two built-in browser APIs — no libraries, no cost, no backend.

**Geolocation:** `navigator.geolocation.watchPosition()` provides continuous live position updates including `coords.heading` (movement direction in degrees) and `coords.speed` (m/s).

**Compass:** `DeviceOrientationEvent` provides `alpha` — the compass heading in degrees.

**Heading logic:** When the user is moving faster than 1.4 m/s (5 km/h), GPS movement heading is used. When stationary, compass heading is used. This matches the behavior of professional navigation apps.

**iOS specific:** On iOS 13+, `DeviceOrientationEvent.requestPermission()` must be called explicitly from a user tap event. This is handled by the location button. Android does not require this extra step.

**User marker:** A blue dot with a semi-transparent directional cone that rotates to show heading. An accuracy circle shows GPS precision. When heading is unavailable, only the dot is shown.

---

## Analytics

Umami analytics is embedded via a single script tag in the HTML head. Umami is self-hosted on Vercel with a Neon Postgres database (both free tiers). It is privacy-friendly, uses no cookies, and is GDPR compliant — important for Swiss and EU users. It tracks visitors, countries, devices, and referrer sources without any consent banner needed.

---

## Hosting

The app is a static site (HTML + CSS + JavaScript bundle only). It is deployed to GitHub Pages at `thatstheend.github.io/avoid-traffic-lights`. No server is required. Hosting cost is zero.

---

## Why these technology choices

| Decision | Choice | Reason |
|---|---|---|
| No backend | Front-end only | All needed APIs are free and CORS-enabled; zero hosting cost |
| Routing | BRouter | Free, OSM-based, supports cycling profiles, returns elevation, handles traffic light penalties natively |
| Traffic lights | Overpass API | Direct access to OSM `highway=traffic_signals` nodes, free, no key |
| Geocoding | Nominatim | Free, OSM-based, no key, sufficient accuracy for city routing |
| Map rendering | MapLibre GL JS | Free open-source Mapbox alternative, WebGL performance, no account needed |
| Elevation | BRouter built-in | Already in the route response, no extra API call needed |
| Analytics | Umami on Vercel | Free, self-hosted, no cookies, GDPR compliant, full data ownership |
| Hosting | GitHub Pages | Free static hosting, sufficient for MVP traffic levels |

---

## Future considerations (not yet implemented)

- **Backend (FastAPI + Python):** Would be added if Overpass/Nominatim rate limits become a problem. Would cache popular routes and eventually run custom routing via `osmnx`.
- **Custom domain:** A domain like `greenlight.bike` (~$12/year) would replace the GitHub Pages subdomain when the app goes public.
- **Own routing engine:** `osmnx` in Python can query OSM directly and run shortest-path with custom traffic light cost functions, eventually replacing the BRouter dependency.
- **Mobile app:** The PWA approach (the current web app made installable) is the first step. React Native would follow if native device features are needed beyond what the browser provides.
