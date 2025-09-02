"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useMap } from "react-leaflet/hooks";
import dynamic from "next/dynamic";

// Load react-leaflet bits client-side only (no SSR)
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);

// Leaflet assets
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// shadcn/ui
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// misc
import { toast } from "sonner";
import {
  MapPin,
  Navigation,
  Filter,
  LocateFixed,
  Plus,
  PlugZap,
  Clock,
  Car,
  Zap,
  Smartphone,
  DollarSign,
  Search,
  Copy,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Configure default Leaflet marker icon
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function kmToStr(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371; // km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

export default function EVChargerFinder() {
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [minPower, setMinPower] = useState<number[]>([22]);
  const [maxPrice, setMaxPrice] = useState<number[]>([0.65]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [sortBy, setSortBy] = useState<"distance" | "power" | "price" | "updated">("distance");
  const [userLoc, setUserLoc] = useLocalStorage("evcf_userloc", { lat: 1.3521, lng: 103.8198 });
  const [selected, setSelected] = useState<any | null>(null);
  const [center, setCenter] = useState(userLoc);

  // Keep the Leaflet map instance to fly programmatically
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({
        lat: String(userLoc.lat),
        lng: String(userLoc.lng),
        radiusKm: "30",
        q: query,
        minPower: String(minPower[0]),
        maxPrice: String(maxPrice[0]),
        onlyAvailable: String(onlyAvailable),
        sortBy,
        limit: "200",
      });
      const res = await fetch(`/api/chargers/search?${params}`, { cache: "no-store" });
      const json = await res.json();
      setChargers(json.items);
      setLoading(false);
    }, 250); // debounce a bit
    return () => clearTimeout(t);
  }, [userLoc, query, minPower, maxPrice, onlyAvailable, sortBy]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.flyTo(center as any, 13, { duration: 0.75 });
    }
  }, [center]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = chargers
      .filter((c: any) => {
        const matchesQ =
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q)
        const matchesPrice = c.pricePerKWh <= maxPrice[0] + 1e-9;
        return matchesQ && matchesPrice;
      })
      .map((c: any) => ({
        ...c,
        distanceKm: haversine(userLoc, c.coords),
        etaMin: Math.round((haversine(userLoc, c.coords) / 40) * 60),
      }));

    const sorter =
      {
        distance: (a: any, b: any) => a.distanceKm - b.distanceKm,
        power: (a: any, b: any) => b.powerKW - a.powerKW,
        price: (a: any, b: any) => a.pricePerKWh - b.pricePerKWh,
        updated: (a: any, b: any) => b.updatedAt - a.updatedAt,
      }[sortBy] || ((a: any, b: any) => 0);

    return filtered.sort(sorter);
  }, [chargers, query, minPower, maxPrice, onlyAvailable, userLoc, sortBy]);

const handleLocate = () => {
  if (!("geolocation" in navigator)) {
    toast.error("Geolocation not supported in this browser");
    return;
  }

  let attempts = 0;

  const opts: PositionOptions = {
    enableHighAccuracy: true,    // use GPS/Wi-Fi if possible
    timeout: 8000,               // fail faster
    maximumAge: 30_000           // accept cached fix up to 30s old
  };

  const request = () => {
    attempts += 1;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(c);
        setCenter(c);
        toast.success("Location updated");
      },
      (err) => {
        // Common Safari/macOS codes:
        // 1: PERMISSION_DENIED, 2: POSITION_UNAVAILABLE, 3: TIMEOUT
        if (err.code === 1) {
          toast.error("Location permission denied. Enable it in browser/site settings.");
          return;
        }
        if (attempts < 3) {
          // brief backoff then retry
          setTimeout(request, attempts * 1500);
        } else {
          toast.error("Couldn’t get your location. Enter coordinates or try again.");
        }
      },
      opts
    );
  };

  request();
};

  const copyShare = async () => {
    const params = new URLSearchParams({
      q: query,
      minPower: String(minPower[0]),
      maxPrice: String(maxPrice[0]),
      onlyAvailable: String(onlyAvailable),
      sortBy,
      lat: String(userLoc.lat),
      lng: String(userLoc.lng),
    }).toString();
    const url = `${location.origin}${location.pathname}?${params}`;
    await navigator.clipboard.writeText(url);
    toast.success("Share link copied");
  };

  useEffect(() => {
    // Read filters from querystring
    const sp = new URLSearchParams(location.search);
    const q = sp.get("q") || "";
    const mp = Number(sp.get("minPower") || 22);
    const pr = Number(sp.get("maxPrice") || 0.65);
    const avail = sp.get("onlyAvailable") === "true";
    const sb = (sp.get("sortBy") as typeof sortBy) || "distance";
    const lat = Number(sp.get("lat"));
    const lng = Number(sp.get("lng"));

    if (!isNaN(lat) && !isNaN(lng)) {
      setUserLoc({ lat, lng });
      setCenter({ lat, lng });
    }
    setQuery(q);
    setMinPower([mp]);
    setMaxPrice([pr]);
    setOnlyAvailable(avail);
    setSortBy(sb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-50 backdrop-blur bg-white/70 border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <PlugZap className="h-6 w-6" />
          <h1 className="text-xl font-semibold">EV Charger Finder</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleLocate}>
              <LocateFixed className="h-4 w-4 mr-1" /> Use my location
            </Button>
            <Button variant="outline" size="sm" onClick={copyShare}>
              <Copy className="h-4 w-4 mr-1" /> Share
            </Button>
            <Button size="sm">
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh charger
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Filters */}
        <Card className="lg:col-span-2 order-2 lg:order-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by name, address"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button variant="outline" size="icon" onClick={() => setQuery("")}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">
                  Min power (kW): {minPower[0]} kW
                </Label>
                <Slider min={3} max={250} step={1} value={minPower} onValueChange={setMinPower} />
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">
                  Max price (S$/kWh): {maxPrice[0].toFixed(2)}
                </Label>
                <Slider min={0.3} max={0.8} step={0.01} value={maxPrice} onValueChange={setMaxPrice} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch id="avail" checked={onlyAvailable} onCheckedChange={setOnlyAvailable} />
                <Label htmlFor="avail">Only show available</Label>
              </div>
              <div className="w-40">
                <Label className="text-xs text-slate-500 mb-1 block">Sort by</Label>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance">Distance</SelectItem>
                    <SelectItem value="power">Power</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="updated">Last updated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border p-3 flex items-start gap-3 bg-slate-50">
              <MapPin className="h-5 w-5 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Your location</div>
                <div className="text-xs text-slate-600">
                  lat {userLoc.lat.toFixed(5)}, lng {userLoc.lng.toFixed(5)}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="0.00001"
                    value={userLoc.lat}
                    onChange={(e) => setUserLoc({ ...userLoc, lat: Number(e.target.value) })}
                    placeholder="Latitude"
                  />
                  <Input
                    type="number"
                    step="0.00001"
                    value={userLoc.lng}
                    onChange={(e) => setUserLoc({ ...userLoc, lng: Number(e.target.value) })}
                    placeholder="Longitude"
                  />
                </div>
              </div>
              <Button variant="outline" onClick={() => setCenter(userLoc)}>
                <Navigation className="h-4 w-4 mr-1" /> Center map
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="lg:col-span-3 order-1 lg:order-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" /> Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[520px] w-full rounded-2xl overflow-hidden border">
              {/* MapContainer renders only on client; we also avoid SSR via dynamic() */}
             
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-[1000]">
                <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
                <span className="ml-2 text-sm text-slate-600">Loading map…</span>
              </div>
            )}
             <MapContainer
              center={[center.lat, center.lng]}
              zoom={12}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* fly to latest center */}
              <FlyTo center={center} />

              {/* user marker */}
              <Marker position={[userLoc.lat, userLoc.lng]} icon={markerIcon}>
                <Popup>You are here</Popup>
              </Marker>

              {/* charger markers */}
              {results.map((c: any) => (
                <Marker
                  key={c.id}
                  position={[c.coords.lat, c.coords.lng]}
                  icon={markerIcon}
                  eventHandlers={{ click: () => setSelected(c) }}
                >
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-slate-600">{c.address}</div>
                      <div className="text-xs flex items-center gap-2">
                        <Badge variant="outline">{c.powerKW} kW</Badge>
                        <Badge variant="outline">S${c.pricePerKWh.toFixed(2)}/kWh</Badge>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
            </div>
          </CardContent>
        </Card>

        {/* Results list */}
        <div className="lg:col-span-5 order-3">
          <Tabs defaultValue="list">
            <TabsList>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="stats">Stats</TabsTrigger>
            </TabsList>
            <TabsContent value="list">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                <AnimatePresence>
                  {results.map((c: any) => (
                    <motion.div
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <Card className="h-full">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center justify-between gap-2">
                            <span className="line-clamp-1">{c.name}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="text-slate-600 line-clamp-2">{c.address}</div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="rounded-lg border p-2 flex items-center gap-2">
                              <Zap className="h-4 w-4" /> {c.powerKW} kW
                            </div>
                            <div className="rounded-lg border p-2 flex items-center gap-2">
                              <DollarSign className="h-4 w-4" /> S${c.pricePerKWh.toFixed(2)}
                            </div>
                            <div className="rounded-lg border p-2 flex items-center gap-2">
                              <Clock className="h-4 w-4" /> {kmToStr(c.distanceKm)}
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button asChild className="flex-1">
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${c.coords.lat},${c.coords.lng}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Navigation className="h-4 w-4 mr-1" /> Go
                              </a>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {results.length === 0 && (
                <div className="text-center text-slate-600 py-16">
                  <Search className="h-6 w-6 mx-auto mb-2" />
                  No chargers match your filters. Try broadening your search.
                </div>
              )}
            </TabsContent>
            <TabsContent value="stats">
              <Card className="mt-3">
                <CardHeader>
                  <CardTitle>Quick stats</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Stat label="Total results" value={results.length} />
                  <Stat
                    label="Median price (S$/kWh)"
                    value={median(results.map((r: any) => r.pricePerKWh)).toFixed(2)}
                  />
                  <Stat
                    label="Median power (kW)"
                    value={Math.round(median(results.map((r: any) => r.powerKW)))}
                  />
                  <Stat
                    label="Avg. distance (km)"
                    value={
                      results.length
                        ? (results.reduce((s: number, r: any) => s + r.distanceKm, 0) / results.length).toFixed(1)
                        : 0
                    }
                  />
                  <Stat
                    label="Fast chargers (≥50kW)"
                    value={results.filter((r: any) => r.powerKW >= 50).length}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="max-w-md w-[95vw]">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <PlugZap className="h-5 w-5" /> {selected.name}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <div className="text-slate-700">{selected.address}</div>
                <div className="grid grid-cols-2 gap-2">
                  <Info label="Power" value={`${selected.powerKW} kW`} />
                  <Info label="Price" value={`S$${selected.pricePerKWh.toFixed(2)}/kWh`} />
                  <Info label="Distance" value={kmToStr(selected.distanceKm)} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Amenities</div>
                  <div className="flex flex-wrap gap-2">
                    {selected.amenities.map((a: string) => (
                      <Badge key={a} variant="secondary">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="text-xs text-slate-500">Updated {timeAgo(selected.updatedAt)}</div>
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" asChild>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selected.coords.lat},${selected.coords.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation className="h-4 w-4 mr-1" /> Navigate
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelected(null);
                      setCenter(selected.coords);
                    }}
                  >
                    Center on map
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function timeAgo(ts: number) {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function median(arr: number[]) {
  if (!arr || arr.length === 0) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function FlyTo({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center as any, 13, { duration: 0.75 });
  }, [center, map]);
  return null;
}
