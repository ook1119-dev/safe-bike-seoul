import type { NextRequest } from "next/server";
import { isInKorea } from "@/lib/geo";
import { getBikeRoute, type RouteMode } from "@/lib/kakao";
import { badRequest, errorResponse } from "@/lib/upstream";

const MODES: RouteMode[] = ["BIKE_ONLY", "SHORTEST"];

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const start = { lat: Number(p.get("sy")), lng: Number(p.get("sx")), name: p.get("sname") ?? undefined };
  const end = { lat: Number(p.get("ey")), lng: Number(p.get("ex")), name: p.get("ename") ?? undefined };
  const mode = (p.get("mode") ?? "BIKE_ONLY") as RouteMode;

  if (!isInKorea(start.lat, start.lng) || !isInKorea(end.lat, end.lng)) {
    return badRequest("출발지 또는 도착지 좌표가 올바르지 않습니다.");
  }
  if (!MODES.includes(mode)) return badRequest("mode는 BIKE_ONLY 또는 SHORTEST만 가능합니다.");

  try {
    const route = await getBikeRoute({ start, end, mode });
    return Response.json(route);
  } catch (err) {
    return errorResponse(err);
  }
}
