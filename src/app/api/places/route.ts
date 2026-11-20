import type { NextRequest } from "next/server";
import { searchPlaces } from "@/lib/kakao";
import { badRequest, errorResponse } from "@/lib/upstream";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) return badRequest("검색어를 입력하세요.");
  if (query.length > 50) return badRequest("검색어가 너무 깁니다.");

  try {
    const places = await searchPlaces(query);
    return Response.json({ places });
  } catch (err) {
    return errorResponse(err);
  }
}
