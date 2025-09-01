"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

// --- Demo dataset: Singapore-centric chargers
const DEFAULT_CHARGERS = [
  {
    id: "sg-001",
    name: "Suntec City Carpark B1",
    coords: { lat: 1.2931, lng: 103.8572 },
    address: "3 Temasek Blvd, Singapore 038983",
    network: "Charge+",
    connectors: ["CCS2", "Type2"],
    powerKW: 60,
    pricePerKWh: 0.5,
    status: "available",
    amenities: ["Mall", "Toilets", "Food Court"],
    updatedAt: Date.now() - 1000 * 60 * 5,
  },
  {
    id: "sg-002",
    name: "ION Orchard L5 EV Bays",
    coords: { lat: 1.304, lng: 103.8318 },
    address: "2 Orchard Turn, Singapore 238801",
    network: "SP Group",
    connectors: ["CCS2", "Type2", "CHAdeMO"],
    powerKW: 150,
    pricePerKWh: 0.55,
    status: "occupied",
    amenities: ["Mall", "Food", "ATM"],
    updatedAt: Date.now() - 1000 * 60 * 2,
  },
  {
    id: "sg-003",
    name: "Jewel Changi B2 Superchargers",
    coords: { lat: 1.3603, lng: 103.9894 },
    address: "78 Airport Blvd, Singapore 819666",
    network: "Tesla",
    connectors: ["Tesla", "CCS2"],
    powerKW: 250,
    pricePerKWh: 0.65,
    status: "available",
    amenities: ["Mall", "Playground", "Attractions"],
    updatedAt: Date.now() - 1000 * 60 * 12,
  },
  {
    id: "sg-004",
    name: "Star Vista Basement Chargers",
    coords: { lat: 1.3065, lng: 103.7908 },
    address: "1 Vista Exchange Green, Singapore 138617",
    network: "Charge+",
    connectors: ["Type2"],
    powerKW: 22,
    pricePerKWh: 0.45,
    status: "available",
    amenities: ["Mall", "Cinema"],
    updatedAt: Date.now() - 1000 * 60 * 24,
  },
  {
    id: "sg-005",
    name: "Vivocity Rooftop EV",
    coords: { lat: 1.2644, lng: 103.8223 },
    address: "1 HarbourFront Walk, Singapore 098585",
    network: "SP Group",
    connectors: ["CCS2"],
    powerKW: 120,
    pricePerKWh: 0.52,
    status: "available",
    amenities: ["Mall", "Sentosa Link"],
    updatedAt: Date.now() - 1000 * 60 * 7,
  },
  {
    id: "sg-006",
    name: "Marina Bay Sands Carpark",
    coords: { lat: 1.2834, lng: 103.8607 },
    address: "10 Bayfront Ave, Singapore 018956",
    network: "BlueSG",
    connectors: ["Type2"],
    powerKW: 43,
    pricePerKWh: 0.48,
    status: "occupied",
    amenities: ["Hotel", "Mall"],
    updatedAt: Date.now() - 1000 * 60 * 9,
  },
  {
    id: "sg-007",
    name: "NTU North Hill Chargers",
    coords: { lat: 1.3483, lng: 103.6831 },
    address: "50 Nanyang Ave, Singapore 639798",
    network: "Shell Recharge",
    connectors: ["CCS2", "Type2"],
    powerKW: 50,
    pricePerKWh: 0.49,
    status: "available",
    amenities: ["Campus", "Cafe"],
    updatedAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: "sg-008",
    name: "Tuas West Road (Public Carpark)",
    coords: { lat: 1.3397, lng: 103.6384 },
    address: "Tuas West Rd, Singapore",
    network: "JomCharge",
    connectors: ["CCS2", "CHAdeMO"],
    powerKW: 60,
    pricePerKWh: 0.47,
    status: "available",
    amenities: ["Restrooms"],
    updatedAt: Date.now() - 1000 * 60 * 45,
  },
  {
    id: "sg-009",
    name: "Paya Lebar Quarter B3",
    coords: { lat: 1.317, lng: 103.8925 },
    address: "10 Paya Lebar Rd, Singapore 409057",
    network: "SP Group",
    connectors: ["CCS2", "Type2"],
    powerKW: 90,
    pricePerKWh: 0.51,
    status: "available",
    amenities: ["Mall"],
    updatedAt: Date.now() - 1000 * 60 * 14,
  },
  {
    id: "sg-010",
    name: "Westgate Carpark",
    coords: { lat: 1.3347, lng: 103.742 },
    address: "3 Gateway Dr, Singapore 608532",
    network: "Charge+",
    connectors: ["Type2"],
    powerKW: 22,
    pricePerKWh: 0.44,
    status: "available",
    amenities: ["Mall"],
    updatedAt: Date.now() - 1000 * 60 * 18,
  },
];

const CONNECTOR_OPTIONS = ["CCS2", "Type2", "CHAdeMO", "Tesla"];
const NETWORKS = ["Any", "SP Group", "Charge+", "Tesla", "BlueSG", "Shell Recharge", "JomCharge"];

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
  const [chargers, setChargers] = useLocalStorage("evcf_chargers", DEFAULT_CHARGERS);
  const [query, setQuery] = useState("");
  const [connector, setConnector] = useState("Any");
  const [minPower, setMinPower] = useState<number[]>([22]);
  const [maxPrice, setMaxPrice] = useState<number[]>([0.65]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [network, setNetwork] = useState("Any");
  const [sortBy, setSortBy] = useState<"distance" | "power" | "price" | "updated">("distance");
  const [userLoc, setUserLoc] = useLocalStorage("evcf_userloc", { lat: 1.3521, lng: 103.8198 });
  const [selected, setSelected] = useState<any | null>(null);
  const [center, setCenter] = useState(userLoc);
  const [busyTick, setBusyTick] = useState(0);

  // Keep the Leaflet map instance to fly programmatically
  const mapRef = useRef<L.Map | null>(null);

  // Simulate status updates
  useEffect(() => {
    const t = setInterval(() => setBusyTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!busyTick) return;
    setChargers((prev: any[]) => {
      const copy = [...prev];
      const i = Math.floor(Math.random() * copy.length);
      copy[i] = {
        ...copy[i],
        status: copy[i].status === "available" ? "occupied" : "available",
        updatedAt: Date.now(),
      };
      return copy;
    });
  }, [busyTick, setChargers]);

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
        const matchesAvail = !onlyAvailable || c.status === "available";
        const matchesNetwork = network === "Any" || c.network === network;
        return matchesQ && matchesPrice && matchesAvail && matchesNetwork;
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
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(c);
        setCenter(c);
        toast.success("Location updated");
      },
      () => toast.error("Couldn't get your location")
    );
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
                <Label className="text-xs text-slate-500 mb-1 block">Connector</Label>
                <Select value={connector} onValueChange={setConnector}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Any">Any</SelectItem>
                    {CONNECTOR_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Network</Label>
                <Select value={network} onValueChange={setNetwork}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORKS.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              <MapContainer
                center={[center.lat, center.lng]}
                zoom={12}
                className="h-full w-full"
                whenCreated={(map) => (mapRef.current = map)}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

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
                          <Badge
                            variant={c.status === "available" ? "default" : "secondary"}
                            className="capitalize"
                          >
                            {c.status}
                          </Badge>
                          <Badge variant="outline">{c.powerKW} kW</Badge>
                          <Badge variant="outline">S${c.pricePerKWh.toFixed(2)}/kWh</Badge>
                        </div>
                        <Button size="sm" className="w-full mt-2" onClick={() => setSelected(c)}>
                          Details
                        </Button>
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
                            <Badge
                              variant={c.status === "available" ? "default" : "secondary"}
                              className="capitalize"
                            >
                              {c.status}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="text-slate-600 line-clamp-2">{c.address}</div>
                          <div className="flex flex-wrap gap-2">
                            {c.connectors.map((t: string) => (
                              <Badge key={t} variant="outline">
                                {t}
                              </Badge>
                            ))}
                          </div>
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
                            <Button className="flex-1" onClick={() => setSelected(c)}>
                              <Smartphone className="h-4 w-4 mr-1" /> Details
                            </Button>
                            <Button variant="outline" asChild>
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
                    label="Available now"
                    value={results.filter((r: any) => r.status === "available").length}
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
                <div className="flex flex-wrap gap-2">
                  {selected.connectors.map((t: string) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Info label="Network" value={selected.network} />
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
