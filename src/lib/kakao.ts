import type { PathPoint } from "./geo";
import { fetchText, requireEnv, UpstreamError } from "./upstream";

export type RouteMode = "BIKE_ONLY" | "SHORTEST";

const ROUTE_STATUS: Record<string, string> = {
  SAME_POINT: "출발지와 도착지가 같습니다.",
  START_LINK_NOT_FOUND: "출발지 주변에서 자전거로 갈 수 있는 길을 찾지 못했습니다.",
  END_LINK_NOT_FOUND: "도착지 주변에서 자전거로 갈 수 있는 길을 찾지 못했습니다.",
  TOO_MANY_SEARCH_LINK: "탐색 범위가 너무 넓어 경로를 계산하지 못했습니다.",
  TOO_FAR_AWAY: "출발지와 도착지가 너무 멀어 자전거 경로를 제공하지 않습니다.",
  ROUTE_RESULT_NOT_FOUND: "조건에 맞는 자전거 경로가 없습니다.",
};

function kakaoError(status: number, body: { message?: string; msg?: string; errorType?: string }) {
  const message = body.message ?? body.msg ?? "";

  if (status === 401) {
    return new UpstreamError("카카오 REST API 키가 올바르지 않습니다.", 502, message);
  }
  if (status === 403) {
    if (/disabled|OPEN_MAP_AND_LOCAL/i.test(message)) {
      return new UpstreamError(
        "카카오맵 사용 설정이 꺼져 있습니다. Kakao Developers > 앱 > 카카오맵에서 사용 설정을 켜 주세요.",
        502,
        message,
      );
    }
    return new UpstreamError("이 카카오 API를 호출할 권한이 없습니다.", 502, message);
  }
  if (status === 429) {
    return new UpstreamError("카카오 API 호출 한도를 초과했습니다.", 502, message);
  }
  return new UpstreamError(`카카오 API 오류 (HTTP ${status})`, 502, message);
}

async function kakaoGet<T>(path: string, params: Record<string, string>) {
  const url = `https://dapi.kakao.com${path}?${new URLSearchParams(params)}`;
  const { status, ok, text } = await fetchText(url, {
    headers: { Authorization: `KakaoAK ${requireEnv("KAKAO_REST_API_KEY")}` },
  });

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new UpstreamError(`카카오 API 응답을 해석하지 못했습니다. (HTTP ${status})`, 502, text.slice(0, 200));
  }
  if (!ok) throw kakaoError(status, json);
  return json as T;
}

type KeywordDoc = {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  category_group_name: string;
  x: string;
  y: string;
};

export async function searchPlaces(query: string) {
  // 서울시청 기준으로 정확도순 검색
  const data = await kakaoGet<{ documents: KeywordDoc[] }>("/v2/local/search/keyword.json", {
    query,
    x: "126.9780",
    y: "37.5665",
    size: "8",
  });
  return data.documents.map((d) => ({
    id: d.id,
    name: d.place_name,
    address: d.road_address_name || d.address_name,
    category: d.category_group_name,
    lat: Number(d.y),
    lng: Number(d.x),
  }));
}

type BikeRouteResponse = {
  status: string;
  route?: {
    properties: { totalDistance: number; totalTime: number; landingUrl?: string };
    legs: { steps: { path?: { points?: number[][] } }[] }[];
  };
};

export async function getBikeRoute(opts: {
  start: { lat: number; lng: number; name?: string };
  end: { lat: number; lng: number; name?: string };
  mode: RouteMode;
}) {
  const params: Record<string, string> = {
    start_x: String(opts.start.lng),
    start_y: String(opts.start.lat),
    end_x: String(opts.end.lng),
    end_y: String(opts.end.lat),
    route_mode: opts.mode,
  };
  if (opts.start.name) params.s_name = opts.start.name;
  if (opts.end.name) params.e_name = opts.end.name;

  const data = await kakaoGet<BikeRouteResponse>("/v2/routing/bicycle", params);

  if (data.status !== "OK" || !data.route) {
    throw new UpstreamError(ROUTE_STATUS[data.status] ?? `경로를 찾지 못했습니다. (${data.status})`, 422, data.status);
  }

  const path: PathPoint[] = [];
  for (const leg of data.route.legs ?? []) {
    for (const step of leg.steps ?? []) {
      for (const p of step.path?.points ?? []) {
        const last = path[path.length - 1];
        if (last && last[0] === p[0] && last[1] === p[1]) continue;
        path.push([p[0], p[1]]);
      }
    }
  }

  return {
    mode: opts.mode,
    distance: data.route.properties.totalDistance,
    duration: data.route.properties.totalTime,
    landingUrl: data.route.properties.landingUrl ?? null,
    path,
    fetchedAt: new Date().toISOString(),
  };
}
