export type LatLng = { lat: number; lng: number };

// 카카오 경로 응답과 같은 [경도, 위도] 순서
export type PathPoint = [number, number];

const EARTH_R = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function distanceM(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

// 점과 경로(선분들) 사이의 최소 거리(m).
// 서울 정도 범위면 점 기준 평면 근사로 계산해도 오차가 거의 없다.
export function distanceToPath(p: LatLng, path: PathPoint[]) {
  if (path.length === 0) return Infinity;

  const mPerLat = EARTH_R * toRad(1);
  const mPerLng = mPerLat * Math.cos(toRad(p.lat));
  const toXY = ([lng, lat]: PathPoint) => [(lng - p.lng) * mPerLng, (lat - p.lat) * mPerLat];

  let min = Infinity;
  let [ax, ay] = toXY(path[0]);
  if (path.length === 1) return Math.hypot(ax, ay);

  for (let i = 1; i < path.length; i++) {
    const [bx, by] = toXY(path[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
    ax = bx;
    ay = by;
  }
  return min;
}

export function isInKorea(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat > 33 && lat < 39 && lng > 124 && lng < 132;
}

export function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)}km`;
}
