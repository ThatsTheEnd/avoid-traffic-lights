# 🚦 GreenLight — Fewest Traffic Lights for Cyclists

[![CI](https://github.com/ThatsTheEnd/avoid-traffic-lights/actions/workflows/ci.yml/badge.svg)](https://github.com/ThatsTheEnd/avoid-traffic-lights/actions/workflows/ci.yml)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue)](https://thatstheend.github.io/avoid-traffic-lights/)

**Plan smarter bike commutes.** GreenLight finds cycling routes with the fewest traffic lights so you can ride uninterrupted.

🌐 **Live app:** [avoid-traffic-lights.lovable.app](https://avoid-traffic-lights.lovable.app) · [GitHub Pages](https://thatstheend.github.io/avoid-traffic-lights/)

---

## Features

- 🗺️ **Smart route comparison** — fetches multiple bike routes and ranks them by traffic light count
- 🚦 **Traffic light detection** — scans intersections along each route using OpenStreetMap data
- 📍 **Current location support** — use GPS to set your starting point with one tap
- 🔗 **Shareable routes** — copy a link with embedded start/end coordinates
- ☀️ **Keep screen on** — wake lock toggle to prevent your phone from sleeping mid-ride
- 📱 **Mobile-first design** — responsive sidebar with slide-out navigation

## How It Works

1. Enter a start and end address (or use your current location)
2. GreenLight queries the [BRouter API](https://brouter.de/) for multiple cycling routes
3. Traffic signals along each route are fetched from the [Overpass API](https://overpass-api.de/)
4. Signals are clustered into intersections and counted per route
5. Routes are displayed on a [MapLibre GL](https://maplibre.org/) map with traffic light markers

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Map | MapLibre GL JS |
| Routing | BRouter API |
| Geocoding | Nominatim (OpenStreetMap) |
| Traffic data | Overpass API |

## Getting Started

```bash
# Clone the repo
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start dev server
npm run dev
```

The app runs at `http://localhost:5173` by default.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run test` | Run tests |
| `npm run lint` | Lint with ESLint |

## Project Structure

```
src/
├── components/
│   ├── AddressInput.tsx    # Autocomplete address search
│   ├── LoadingProgress.tsx # Step-by-step loading indicator
│   ├── LocationButton.tsx  # GPS location toggle
│   ├── MapView.tsx         # MapLibre GL map wrapper
│   ├── RouteCard.tsx       # Route summary card
│   ├── Sidebar.tsx         # Main sidebar with inputs & results
│   └── ui/                 # shadcn/ui components
├── hooks/
│   ├── use-mobile.tsx      # Mobile breakpoint detection
│   └── use-wake-lock.ts   # Screen Wake Lock API hook
├── lib/
│   ├── api.ts              # Route, geocode & traffic light APIs
│   └── reverseGeocode.ts  # Reverse geocoding helper
└── pages/
    └── Index.tsx           # Main page orchestrator
```

## License

This project is open source. Feel free to fork and adapt for your own city or use case.
