import { config } from "dotenv";
config({ path: ".env.local" }); 

import { getRedis } from "@/lib/redis";
const SEED = [
  {
    id: "sg-001",
    name: "Suntec City Carpark B1",
    coords: { lat: 1.2931, lng: 103.8572 },
    address: "3 Temasek Blvd, Singapore 038983",
    powerKW: 60,
    pricePerKWh: 0.5,
    amenities: ["Mall", "Toilets", "Food Court"],
    updatedAt: Date.now() - 1000 * 60 * 5,
  },
  {
    id: "sg-002",
    name: "ION Orchard L5 EV Bays",
    coords: { lat: 1.304, lng: 103.8318 },
    address: "2 Orchard Turn, Singapore 238801",
    powerKW: 150,
    pricePerKWh: 0.55,
    amenities: ["Mall", "Food", "ATM"],
    updatedAt: Date.now() - 1000 * 60 * 2,
  },
  {
    id: "sg-003",
    name: "Jewel Changi B2 Superchargers",
    coords: { lat: 1.3603, lng: 103.9894 },
    address: "78 Airport Blvd, Singapore 819666",
    powerKW: 250,
    pricePerKWh: 0.55,
    amenities: ["Mall", "Playground", "Attractions"],
    updatedAt: Date.now() - 1000 * 60 * 12,
  },
  {
    id: "sg-004",
    name: "Star Vista Basement Chargers",
    coords: { lat: 1.3065, lng: 103.7908 },
    address: "1 Vista Exchange Green, Singapore 138617",
    powerKW: 22,
    pricePerKWh: 0.45,
    amenities: ["Mall", "Cinema"],
    updatedAt: Date.now() - 1000 * 60 * 24,
  },
  {
    id: "sg-005",
    name: "Vivocity Rooftop EV",
    coords: { lat: 1.2644, lng: 103.8223 },
    address: "1 HarbourFront Walk, Singapore 098585",
    powerKW: 120,
    pricePerKWh: 0.52,
    amenities: ["Mall", "Sentosa Link"],
    updatedAt: Date.now() - 1000 * 60 * 7,
  },
  {
    id: "sg-006",
    name: "Marina Bay Sands Carpark",
    coords: { lat: 1.2834, lng: 103.8607 },
    address: "10 Bayfront Ave, Singapore 018956",
    powerKW: 43,
    pricePerKWh: 0.48,
    amenities: ["Hotel", "Mall"],
    updatedAt: Date.now() - 1000 * 60 * 9,
  },
  {
    id: "sg-007",
    name: "NTU North Hill Chargers",
    coords: { lat: 1.3483, lng: 103.6831 },
    address: "50 Nanyang Ave, Singapore 639798",
    powerKW: 50,
    pricePerKWh: 0.49,
    amenities: ["Campus", "Cafe"],
    updatedAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: "sg-008",
    name: "Tuas West Road (Public Carpark)",
    coords: { lat: 1.3397, lng: 103.6384 },
    address: "Tuas West Rd, Singapore",
    powerKW: 60,
    pricePerKWh: 0.47,
    amenities: ["Restrooms"],
    updatedAt: Date.now() - 1000 * 60 * 45,
  },
  {
    id: "sg-009",
    name: "Paya Lebar Quarter B3",
    coords: { lat: 1.317, lng: 103.8925 },
    address: "10 Paya Lebar Rd, Singapore 409057",
    powerKW: 90,
    pricePerKWh: 0.51,
    amenities: ["Mall"],
    updatedAt: Date.now() - 1000 * 60 * 14,
  },
  {
    id: "sg-010",
    name: "Westgate Carpark",
    coords: { lat: 1.3347, lng: 103.742 },
    address: "3 Gateway Dr, Singapore 608532",
    powerKW: 22,
    pricePerKWh: 0.44,
    amenities: ["Mall"],
    updatedAt: Date.now() - 1000 * 60 * 18,
  },
];

async function main() {
  const redis = getRedis();

  for (const c of SEED) {
    const id = c.id || `seed-${c.coords.lat}-${c.coords.lng}`;
    await redis.hSet(`charger:${id}`, {
      id,
      name: c.name,
      address: c.address,
      powerKW: String(c.powerKW),
      pricePerKWh: String(c.pricePerKWh),
      amenities: JSON.stringify(c.amenities || []),
      updatedAt: String(c.updatedAt ?? Date.now()),
      lat: String(c.coords.lat),
      lng: String(c.coords.lng),
    });
    await redis.geoAdd("chargers:geo", {
      longitude: c.coords.lng,
      latitude: c.coords.lat,
      member: id,
    });
  }

  console.log("Seeded chargers ✅");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});