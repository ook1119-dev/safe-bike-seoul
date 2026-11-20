import type { PathPoint } from "./geo";
import { dataGoKrKey, fetchText, mapLimit, parseDataGoKr, UpstreamError } from "./upstream";

// 한국도로교통공단 자전거 교통사고 다발지역 (공공데이터포털 15056681)
const ENDPOINT = "https://apis.data.go.kr/B552061/frequentzoneBicycle/getRestFrequentzoneBicycle";

const SEOUL_SIDO = "11";
const SEOUL_GU: [string, string][] = [
  ["110", "종로구"], ["140", "중구"], ["170", "용산구"], ["200", "성동구"], ["215", "광진구"],
  ["230", "동대문구"], ["260", "중랑구"], ["290", "성북구"], ["305", "강북구"], ["320", "도봉구"],
  ["350", "노원구"], ["380", "은평구"], ["410", "서대문구"], ["440", "마포구"], ["470", "양천구"],
  ["500", "강서구"], ["530", "구로구"], ["545", "금천구"], ["560", "영등포구"], ["590", "동작구"],
  ["620", "관악구"], ["650", "서초구"], ["680", "강남구"], ["710", "송파구"], ["740", "강동구"],
];

// 최신 연도를 찾을 때 먼저 찔러볼 구 (자전거 사고가 많은 곳)
const PROBE_GU = ["560", "710", "500", "440", "350"];

export type Hotspot = {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  accidents: number;
  casualties: number;
  deaths: number;
  serious: number;
  minor: number;
  reported: number;
  polygon: PathPoint[] | null;
};

type RawItem = Record<string, string | number | null | undefined>;

const CACHE_MS = 12 * 60 * 60 * 1000;
let cached: { savedAt: number; data: HotspotData } | null = null;
let pending: Promise<HotspotData> | null = null;

export type HotspotData = {
  year: number;
  checkedYears: number[];
  fetchedAt: string;
  hotspots: Hotspot[];
};

function parsePolygon(geom: unknown): PathPoint[] | null {
  if (typeof geom !== "string" || !geom) return null;
  try {
    const g = JSON.parse(geom);
    const ring = g.type === "MultiPolygon" ? g.coordinates?.[0]?.[0] : g.coordinates?.[0];
    if (!Array.isArray(ring)) return null;
    return ring.map((p: number[]) => [Number(p[0]), Number(p[1])] as PathPoint);
  } catch {
    return null;
  }
}

function toHotspot(item: RawItem, district: string): Hotspot {
  const n = (k: string) => Number(item[k]) || 0;
  return {
    id: String(item.afos_fid ?? item.spot_cd ?? `${item.la_crd},${item.lo_crd}`),
    name: String(item.spot_nm ?? "").trim() || "이름 없는 지점",
    // "서울 영등포구1" 처럼 뒤에 일련번호가 붙어서 온다
    district: String(item.sido_sgg_nm ?? `서울 ${district}`).trim().replace(/\d+$/, ""),
    lat: Number(item.la_crd),
    lng: Number(item.lo_crd),
    accidents: n("occrrnc_cnt"),
    casualties: n("caslt_cnt"),
    deaths: n("dth_dnv_cnt"),
    serious: n("se_dnv_cnt"),
    minor: n("sl_dnv_cnt"),
    reported: n("wnd_dnv_cnt"),
    polygon: parsePolygon(item.geom_json),
  };
}

async function fetchDistrict(year: number, guCode: string) {
  const params = new URLSearchParams({
    ServiceKey: dataGoKrKey(),
    searchYearCd: String(year),
    siDo: SEOUL_SIDO,
    guGun: guCode,
    type: "json",
    numOfRows: "100",
    pageNo: "1",
  });
  const { status, ok, text } = await fetchText(`${ENDPOINT}?${params}`);
  const json = parseDataGoKr(status, ok, text);

  // 응답 형태가 {resultCode, items} 또는 {response: {header, body}} 두 가지로 와서 둘 다 처리
  const header = json.response?.header ?? json;
  const body = json.response?.body ?? json;
  const code = String(header.resultCode ?? "00");

  if (code === "03") return []; // NODATA
  if (code !== "00") {
    throw new UpstreamError(`사고다발지역 API 오류: ${header.resultMsg ?? code}`, 502, code);
  }

  const raw = body.items?.item ?? body.items ?? [];
  const list: RawItem[] = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
  const district = SEOUL_GU.find(([c]) => c === guCode)?.[1] ?? "";

  return list
    .map((item) => toHotspot(item, district))
    .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng) && h.lat !== 0);
}

async function loadLatest(): Promise<HotspotData> {
  const kstYear = new Date(Date.now() + 9 * 3600_000).getUTCFullYear();
  const checkedYears: number[] = [];

  // 통계는 보통 1~2년 늦게 공개되므로 작년부터 거꾸로 확인
  for (let year = kstYear - 1; year >= kstYear - 6; year--) {
    checkedYears.push(year);
    const probe = await Promise.all(PROBE_GU.map((gu) => fetchDistrict(year, gu)));
    if (probe.every((list) => list.length === 0)) continue;

    const rest = SEOUL_GU.map(([code]) => code).filter((code) => !PROBE_GU.includes(code));
    const others = await mapLimit(rest, 5, (gu) => fetchDistrict(year, gu));

    const seen = new Set<string>();
    const hotspots = [...probe.flat(), ...others.flat()].filter((h) => {
      if (seen.has(h.id)) return false;
      seen.add(h.id);
      return true;
    });

    return { year, checkedYears, fetchedAt: new Date().toISOString(), hotspots };
  }

  throw new UpstreamError(
    `최근 연도(${checkedYears[checkedYears.length - 1]}~${checkedYears[0]})의 서울 자전거 사고다발지역 데이터를 찾지 못했습니다.`,
    404,
  );
}

export async function getSeoulHotspots(force = false) {
  if (!force && cached && Date.now() - cached.savedAt < CACHE_MS) return cached.data;

  if (!pending) {
    pending = loadLatest()
      .then((data) => {
        cached = { savedAt: Date.now(), data };
        return data;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
