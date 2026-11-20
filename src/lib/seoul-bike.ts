import { fetchText, requireEnv, UpstreamError } from "./upstream";

export type Station = {
  id: string;
  no: string;
  name: string;
  lat: number;
  lng: number;
  bikes: number;
  racks: number;
};

type BikeRow = {
  stationId: string;
  stationName: string;
  stationLatitude: string;
  stationLongitude: string;
  parkingBikeTotCnt: string;
  rackTotCnt: string;
};

type SeoulResult = { CODE: string; MESSAGE: string };

const PAGE_SIZE = 1000;
const CACHE_MS = 60_000;

let cached: { fetchedAt: string; savedAt: number; stations: Station[] } | null = null;
let pending: Promise<{ fetchedAt: string; stations: Station[] }> | null = null;

// 서울 열린데이터광장 Open API는 8088 포트의 HTTP만 지원한다(HTTPS 미지원).
// 인증키가 평문으로 전송되기 때문에 SEOUL_ALLOW_HTTP=true 로 명시했을 때만 호출한다.
function baseUrl() {
  if (process.env.SEOUL_ALLOW_HTTP?.trim().toLowerCase() !== "true") {
    throw new UpstreamError(
      "서울시 API는 HTTP로만 호출할 수 있습니다. 환경변수 SEOUL_ALLOW_HTTP=true 를 설정하세요.",
      500,
    );
  }
  return "http://openapi.seoul.go.kr:8088";
}

function seoulError(result: SeoulResult) {
  if (result.CODE === "INFO-100") {
    return new UpstreamError("서울시 인증키가 유효하지 않습니다. SEOUL_API_KEY를 확인하세요.", 502, result.CODE);
  }
  return new UpstreamError(`서울시 API 오류: ${result.MESSAGE.trim()}`, 502, result.CODE);
}

async function fetchPage(key: string, start: number): Promise<BikeRow[]> {
  const end = start + PAGE_SIZE - 1;
  const url = `${baseUrl()}/${encodeURIComponent(key)}/json/bikeList/${start}/${end}/`;
  const { status, text } = await fetchText(url, {}, 12_000);

  let json: { rentBikeStatus?: { RESULT: SeoulResult; row?: BikeRow[] }; RESULT?: SeoulResult };
  try {
    json = JSON.parse(text);
  } catch {
    // 인증키 오류 같은 경우 json을 요청해도 XML로 응답이 온다
    const code = text.match(/<CODE>([^<]+)<\/CODE>/)?.[1];
    const message = text.match(/<MESSAGE><!\[CDATA\[([\s\S]*?)\]\]><\/MESSAGE>/)?.[1];
    if (code) throw seoulError({ CODE: code, MESSAGE: message ?? code });
    throw new UpstreamError(`서울시 API 응답을 해석하지 못했습니다. (HTTP ${status})`, 502);
  }

  const result = json.rentBikeStatus?.RESULT ?? json.RESULT;
  if (result?.CODE === "INFO-200") return []; // 해당 범위에 데이터 없음
  if (result && result.CODE !== "INFO-000") throw seoulError(result);

  return json.rentBikeStatus?.row ?? [];
}

function toStation(row: BikeRow): Station {
  // "102. 망원역 1번출구 앞" -> 번호 / 이름 분리
  const match = row.stationName.match(/^\s*(\d+)\.\s*(.+)$/);
  return {
    id: row.stationId,
    no: match?.[1] ?? "",
    name: (match?.[2] ?? row.stationName).trim(),
    lat: Number(row.stationLatitude),
    lng: Number(row.stationLongitude),
    bikes: Number(row.parkingBikeTotCnt) || 0,
    racks: Number(row.rackTotCnt) || 0,
  };
}

async function fetchAllStations() {
  const key = requireEnv("SEOUL_API_KEY");
  const rows: BikeRow[] = [];

  // 대여소가 3천 곳 정도라 1000건씩 3페이지를 먼저 받고, 꽉 차 있으면 더 받는다
  let start = 1;
  while (start < 10_000) {
    const starts = [start, start + PAGE_SIZE, start + PAGE_SIZE * 2];
    const pages = await Promise.all(starts.map((s) => fetchPage(key, s)));
    pages.forEach((page) => rows.push(...page));
    if (pages[pages.length - 1].length < PAGE_SIZE) break;
    start += PAGE_SIZE * 3;
  }

  const stations = rows
    .map(toStation)
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && s.lat !== 0);

  if (stations.length === 0) {
    throw new UpstreamError("서울시 API에서 대여소 정보를 받지 못했습니다.", 502);
  }
  return { fetchedAt: new Date().toISOString(), stations };
}

export async function getStations() {
  if (cached && Date.now() - cached.savedAt < CACHE_MS) return cached;

  if (!pending) {
    pending = fetchAllStations()
      .then((data) => {
        cached = { ...data, savedAt: Date.now() };
        return data;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
