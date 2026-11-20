import type { NextRequest } from "next/server";
import { isInKorea } from "@/lib/geo";
import { getForecast } from "@/lib/kma";
import { badRequest, errorResponse } from "@/lib/upstream";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  if (!isInKorea(lat, lng)) return badRequest("lat, lng 값이 올바르지 않습니다.");

  try {
    const forecast = await getForecast(lat, lng);
    return Response.json(forecast);
  } catch (err) {
    return errorResponse(err);
  }
}
