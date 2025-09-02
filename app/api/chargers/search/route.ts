import { NextRequest, NextResponse } from "next/server";
import { searchChargers } from "../../../../lib/searchCharger";


export const runtime = "nodejs";        // optional
export const dynamic = "force-dynamic"; // optional (disable prerendering)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  console.log(`data: ${searchParams}`)

  const items = await searchChargers({
    lat: Number(searchParams.get("lat") ?? 1.3521),
    lng: Number(searchParams.get("lng") ?? 103.8198),
    radiusKm: Number(searchParams.get("radiusKm") ?? 30),
    limit: Number(searchParams.get("limit") ?? 200),
    minPower: Number(searchParams.get("minPower") ?? 0),
    maxPrice: Number(searchParams.get("maxPrice") ?? 10),
    q: searchParams.get("q") ?? "",
    sortBy: (searchParams.get("sortBy") ?? "distance") as
      | "distance"
      | "power"
      | "price"
      | "updated",
  });

  return NextResponse.json({ items });
}