import { dataGoKrKey, fetchText, parseDataGoKr, UpstreamError } from "./upstream";

const ENDPOINT = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";
const KST = 9 * 3600_000;

const pad = (n: number) => String(n).padStart(2, "0");

// 위경도 -> 기상청 격자(nx, ny). 기상청 단기예보 활용가이드의 LCC 변환식
export function toKmaGrid(lat: number, lng: number) {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;

  const DEG = Math.PI / 180;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEG;
  const slat2 = SLAT2 * DEG;
  const olon = OLON * DEG;
  const olat = OLAT * DEG;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEG * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lng * DEG - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

// 단기예보는 02, 05, 08, 11, 14, 17, 20, 23시에 발표되고 10분 뒤부터 API로 제공된다.
// stepsBack 만큼 이전 발표분을 반환 (최신 발표가 아직 안 올라왔을 때 사용)
export function kmaBaseTime(now: Date, stepsBack = 0) {
  const k = new Date(now.getTime() + KST - 10 * 60_000);
  const h = k.getUTCHours();
  const baseHour = h < 2 ? -1 : h - ((h - 2) % 3); // -1시 = 전날 23시
  const base = new Date(
    Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), baseHour) - stepsBack * 3 * 3600_000,
  );
  return {
    baseDate: `${base.getUTCFullYear()}${pad(base.getUTCMonth() + 1)}${pad(base.getUTCDate())}`,
    baseTime: `${pad(base.getUTCHours())}00`,
  };
}

// "20261120" + "1400" -> "2026-11-20T14:00:00+09:00"
function toIso(date: string, time: string) {
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:00+09:00`;
}

type FcstItem = {
  baseDate: string;
  baseTime: string;
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string;
};

export type ForecastSlot = {
  at: string;
  tmp: number | null;
  pop: number | null;
  pty: number | null;
  sky: number | null;
  wsd: number | null;
  reh: number | null;
  pcp: string | null;
};

async function request(nx: number, ny: number, baseDate: string, baseTime: string) {
  const params = new URLSearchParams({
    serviceKey: dataGoKrKey(),
    pageNo: "1",
    numOfRows: "400",
    dataType: "JSON",
    base_date: baseDate,
    base_time: baseTime,
    nx: String(nx),
    ny: String(ny),
  });
  const { status, ok, text } = await fetchText(`${ENDPOINT}?${params}`);
  const json: {
    response?: {
      header?: { resultCode: string; resultMsg: string };
      body?: { items?: { item?: FcstItem[] } };
    };
  } = parseDataGoKr(status, ok, text);

  const header = json.response?.header;
  if (header?.resultCode === "03") return null; // 아직 발표 자료 없음
  if (header?.resultCode !== "00") {
    throw new UpstreamError(`기상청 API 오류: ${header?.resultMsg ?? "알 수 없는 응답"}`, 502, header?.resultCode);
  }
  return json.response?.body?.items?.item ?? [];
}

export async function getForecast(lat: number, lng: number, now = new Date()) {
  const { nx, ny } = toKmaGrid(lat, lng);

  let base = kmaBaseTime(now);
  let items = await request(nx, ny, base.baseDate, base.baseTime);
  if (!items || items.length === 0) {
    base = kmaBaseTime(now, 1);
    items = await request(nx, ny, base.baseDate, base.baseTime);
  }
  if (!items || items.length === 0) {
    throw new UpstreamError("기상청 단기예보 자료가 아직 없습니다. 잠시 후 다시 시도하세요.", 502);
  }

  const slots = new Map<string, ForecastSlot>();
  for (const item of items) {
    const key = item.fcstDate + item.fcstTime;
    if (!slots.has(key)) {
      slots.set(key, {
        at: toIso(item.fcstDate, item.fcstTime),
        tmp: null, pop: null, pty: null, sky: null, wsd: null, reh: null, pcp: null,
      });
    }
    const slot = slots.get(key)!;
    const v = item.fcstValue;
    switch (item.category) {
      case "TMP": slot.tmp = Number(v); break;
      case "POP": slot.pop = Number(v); break;
      case "PTY": slot.pty = Number(v); break;
      case "SKY": slot.sky = Number(v); break;
      case "WSD": slot.wsd = Number(v); break;
      case "REH": slot.reh = Number(v); break;
      case "PCP": slot.pcp = v; break;
    }
  }

  // 현재 시각(정시 기준) 이후 예보부터 사용
  const k = new Date(now.getTime() + KST);
  const nowKey = `${k.getUTCFullYear()}${pad(k.getUTCMonth() + 1)}${pad(k.getUTCDate())}${pad(k.getUTCHours())}00`;
  const upcoming = [...slots.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([key]) => key >= nowKey)
    .map(([, slot]) => slot);

  if (upcoming.length === 0) {
    throw new UpstreamError("현재 시각 이후의 예보 값을 찾지 못했습니다.", 502);
  }

  return {
    grid: { nx, ny },
    baseDate: base.baseDate,
    baseTime: base.baseTime,
    issuedAt: toIso(base.baseDate, base.baseTime),
    fetchedAt: new Date().toISOString(),
    current: upcoming[0],
    hourly: upcoming.slice(0, 8),
  };
}
