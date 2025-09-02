# EV Charger Finder — Redis Geo Demo
This app is a Next.js (App Router) demo that showcases geolocation search with Redis using a real, map-based experience for EV chargers. It’s designed to make the geo pieces obvious, simple, and fast — so you can see why Redis stands out versus generic “filter + sort in app code” or non-native geo approaches.

# Why Redis for geosearch?
Redis (with Redis Stack commands available in vanilla Redis today) gives you:
Native geo indexing on a Sorted Set: store points with GEOADD and query by radius/box with GEOSEARCH.
→ Results include distance and coordinates (WITHDIST, WITHCOORD) for instant sorting and display.

Predictable low latency at scale: in-memory data structure ops, not full-text pipelines or complex joins.
Simple data model: one geo index (sorted set) for proximity + a hash per item for metadata.
→ No ORMs, no spatial extensions, no cluster-only features.

Composable: read the nearby ids, fetch hashes in a batch, then apply lightweight filters (price/power) in your app code.

If you’re comparing to:
- Client-side filtering: you still need a server to compute distances accurately and efficiently. Doing it client-side scales badly.
- Generic DBs without geo: you’ll end up storing lat/lng and running expensive distance math or table scans.
- Search engines: powerful but heavier to run/operate for simple “nearby places” use cases.

# What the demo includes
- React + Leaflet map (client only) with OpenStreetMap tiles.
- Server API: 
    - /api/chargers/search performs Redis geosearch, returns chargers + distances.
    - Script to preload EV details into redis
- Filters: query text, max price, min power (example fields).

# Project Structure
```
app/
  api/
    chargers/
      search/
        route.ts         # GET handler, calls searchChargers()
  page.tsx               # imports the client component
components/
  EVChargerFinder.tsx    # "use client" – the UI and fetch to /api/chargers/search
lib/
  redis.ts               # getRedis() – ioredis/redis client bootstrap
  searchCharger.ts       # searchChargers() – Redis GEO + HGETALL logic
```

# Prerequisites
- Node.js 20+
- Redis (local or managed). Set REDIS_URL in env to connect (e.g. redis://localhost:6379 or rediss://...).

## Getting Started
1. Install
```
npm install
```
2. Populate Environment Variable
Create `.env.local` 
```
export REDIS_HOST={}
export REDIS_PORT={}
```
3. Seed some data
Seed some data (sample script below)
```
npm run seed
```
4. Run
```
npm run dev
```

# Redis Data Model
- Geo index (sorted set): chargers:geo
Each member is a charger id (string). We add with GEOADD and query with GEOSEARCH.

- Hash per charger: charger:<id>
Fields used by the demo:
name, address, lat, lng (optional if you rely on WITHCOORD from GEO), powerKW, pricePerKWh, status, amenities (JSON array as string, updatedAt (epoch ms)

# Important Code Path Demo
1) Server code to search for chargers
```
import { getRedis } from "@/lib/redis";

type SortBy = "distance" | "power" | "price" | "updated";

export async function searchChargers(opts: {
  lat: number; lng: number; radiusKm?: number; limit?: number;
  minPower?: number; maxPrice?: number; q?: string; sortBy?: SortBy;
}) {
  const {
    lat, lng, radiusKm = 30, limit = 200,
    minPower = 0, maxPrice = 10, q = "", sortBy = "distance",
  } = opts;

  const redis = getRedis();

  // 1) Geo search for nearby ids (+ distance, + coords)
  const geo = await redis.geoSearchWith(
    "chargers:geo",
    { longitude: lng, latitude: lat },
    { radius: radiusKm, unit: "km" },
    ["WITHDIST", "WITHCOORD"],
    { COUNT: limit, SORT: "ASC" }
  );

  // 2) Load metadata in parallel
  const ids = geo.map(g => g.member as string);
  const hashes = await Promise.all(ids.map(id => redis.hGetAll(`charger:${id}`)));

  // 3) Merge + normalize
  let items = ids.map((id, i) => {
    const h = hashes[i], g = geo[i];
    const coords = (h.lat && h.lng)
      ? { lat: Number(h.lat), lng: Number(h.lng) }
      : g.coordinates ? { lat: g.coordinates.latitude, lng: g.coordinates.longitude } : undefined;

    return {
      id, name: h.name, address: h.address,
      powerKW: Number(h.powerKW), pricePerKWh: Number(h.pricePerKWh),
      status: h.status, amenities: JSON.parse(h.amenities || "[]"),
      updatedAt: Number(h.updatedAt),
      coords, distanceKm: g.distance ? Number(g.distance) : NaN,
    };
  });

  // 4) Light filters in app code (fast)
  const query = q.toLowerCase().trim();
  items = items.filter(c => {
    const matchesQ = !query || c.name?.toLowerCase().includes(query) || c.address?.toLowerCase().includes(query);
    const matchesPower = c.powerKW >= minPower;
    const matchesPrice = c.pricePerKWh <= maxPrice + 1e-9;
    return matchesQ && matchesPower && matchesPrice;
  });

  // 5) Sort if needed (distance is already ASC from Redis)
  if (sortBy !== "distance") {
    items.sort((a, b) => {
      if (sortBy === "power") return b.powerKW - a.powerKW;
      if (sortBy === "price") return a.pricePerKWh - b.pricePerKWh;
      if (sortBy === "updated") return b.updatedAt - a.updatedAt;
      return 0;
    });
  }

  return items;
}
```

## Code Breakdown
1. In searchChargers you hit Redis’ native geo index:
```
const geo = await redis.geoSearchWith(
  "chargers:geo",
  { longitude: lng, latitude: lat },
  { radius: radiusKm, unit: "km" },
  ["WITHDIST", "WITHCOORD"],
  { COUNT: limit, SORT: "ASC" }
);
```
- The `chargers:geo` sorted set stores each charger’s coordinates.
- GEOSEARCH returns nearest members within your radius, already sorted by distance (ASC), and includes distance + coords.

2. Fetch Charger Metadata
You take the returned IDs and HGETALL the corresponding hashes in parallel
```
const ids = geo.map(g => g.member as string);
const hashes = await Promise.all(ids.map(id => redis.hGetAll(`charger:${id}`)));
```
These hashes hold fields like name, address, powerKW, pricePerKWh, status, updatedAt, etc.

3. Merge & normalize
You combine the geo row + hash into one object per charger, ensuring coords and distanceKm are present.

4. Filter in app code (cheap because result set is already “nearby”)
You run lightweight filters on the small candidate set:
- Text query over name / address
- Numeric constraints: minPower, maxPrice
- This is fast because Redis already reduced the universe to “nearby chargers”.

5. Sort
- If sortBy === "distance", you keep the Redis order (already ASC).
- Otherwise you sort the filtered list in memory by power, price, or updatedAt.

6. Return JSON
The API responds with { items: [...] }.
The client renders markers + list + stats.


# Access the demo
https://ev-charger-location.vercel.app/

# Extending the demo
1. Identify public API to pull all EV chargers data and store in redis
    - Open Charge Map / your DB: import real chargers and pipe into the same Redis schema.
2. Availability & pricing updates: push updates to the hashes; sort by updatedAt.
