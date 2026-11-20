import type { NextRequest } from "next/server";
import { getSeoulHotspots } from "@/lib/hotspots";
import { errorResponse } from "@/lib/upstream";

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("refresh") === "1";
  try {
    const data = await getSeoulHotspots(force);
    return Response.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
