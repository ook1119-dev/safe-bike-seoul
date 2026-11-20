import type { NextRequest } from "next/server";
import { distanceM, isInKorea } from "@/lib/geo";
import { getStations } from "@/lib/seoul-bike";
import { badRequest, errorResponse } from "@/lib/upstream";

const MAX_RESULTS = 300;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const radius = Number(params.get("radius") ?? 1000); // 0이면 전체

  if (!isInKorea(lat, lng)) return badRequest("lat, lng 값이 올바르지 않습니다.");
  if (!Number.isFinite(radius) || radius < 0) return badRequest("radius 값이 올바르지 않습니다.");

  try {
    const { stations, fetchedAt } = await getStations();
    const origin = { lat, lng };

    const matched = stations
      .map((s) => ({ ...s, distance: Math.round(distanceM(origin, s)) }))
      .filter((s) => radius === 0 || s.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    return Response.json({
      fetchedAt,
      totalStations: stations.length,
      matched: matched.length,
      stations: matched.slice(0, MAX_RESULTS),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
