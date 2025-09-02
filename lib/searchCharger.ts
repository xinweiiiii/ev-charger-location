import { getRedis } from "@/lib/redis";
type SortBy = "distance" | "power" | "price" | "updated";
export async function searchChargers(opts: {
  lat: number;
  lng: number;
  radiusKm?: number;
  limit?: number;
  minPower?: number;
  maxPrice?: number;
  q?: string;
  sortBy?: SortBy;
}) {
    const {
        lat,
        lng,
        radiusKm = 30,
        limit = 200,
        minPower = 0,
        maxPrice = 10,
        q = "",
        sortBy = "distance",
    } = opts;

    const redis = getRedis();

    // get nearby ids + distance first
    const geo = await redis.geoSearchWith(
        "chargers:geo",
        { longitude: lng, latitude: lat },
        { radius: radiusKm, unit: "km" },
        ["WITHDIST", "WITHCOORD"],          // distance + coordinates
        { COUNT: limit, SORT: "ASC" }
    );

    // load hashes in parallel (typed nicely)
    const ids = geo.map(g => g.member as string);
    const hashes = await Promise.all(
        ids.map(id => redis.hGetAll(`charger:${id}`) as Promise<Record<string, string>>)
    );

    let items = ids.map((id, i) => {
        const h = hashes[i];
        const g = geo[i]; // { member, distance, coordinates?: [lon,lat] }

        // Prefer lat/lng from hash if stored; else fall back to geo.coordinates
        const coords =
            (h.lat && h.lng)
            ? { lat: Number(h.lat), lng: Number(h.lng) }
            : g.coordinates
                ? { lat: g.coordinates.latitude, lng: g.coordinates.longitude }
                : undefined;

        return {
            id,
            name: h.name,
            address: h.address,
            powerKW: Number(h.powerKW),
            pricePerKWh: Number(h.pricePerKWh),
            status: h.status,
            amenities: JSON.parse(h.amenities || "[]"),
            updatedAt: Number(h.updatedAt),
            coords,
            distanceKm: g.distance ? Number(g.distance) : NaN,
        };
    });

    // filter
    const query = q.toLowerCase().trim();
    items = items.filter((c) => {
        const matchesQ =
        !query ||
        c.name?.toLowerCase().includes(query) ||
        c.address?.toLowerCase().includes(query)
    

        const matchesPower = c.powerKW >= minPower;
        const matchesPrice = c.pricePerKWh <= maxPrice + 1e-9;

        return (
        matchesQ &&
        matchesPower &&
        matchesPrice
        );
    });

    // sort (distance already ASC)
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
