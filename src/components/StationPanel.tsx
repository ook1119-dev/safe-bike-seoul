"use client";

import { formatKst } from "@/lib/client";
import { formatDistance } from "@/lib/geo";
import type { Place, StationsResponse, StationWithDistance } from "@/lib/types";

const RADIUS_OPTIONS = [
  { value: 500, label: "500m" },
  { value: 1000, label: "1km" },
  { value: 2000, label: "2km" },
  { value: 5000, label: "5km" },
  { value: 0, label: "전체" },
];

type Props = {
  origin: Place;
  radius: number;
  onRadiusChange: (radius: number) => void;
  onlyAvailable: boolean;
  onOnlyAvailableChange: (value: boolean) => void;
  data?: StationsResponse;
  stations: StationWithDistance[];
  loading: boolean;
  error?: string;
  selectedId: string | null;
  onSelect: (station: StationWithDistance) => void;
  onRefresh: () => void;
};

export default function StationPanel(props: Props) {
  const { origin, radius, data, stations, loading, error, selectedId } = props;
  const shown = stations.slice(0, 30);

  return (
    <section className="card" id="stations">
      <div className="card-head">
        <h2>출발지 주변 따릉이</h2>
        <span className="count">{data ? `${stations.length}곳` : "—"}</span>
      </div>
      <p className="card-sub">
        기준: <strong>{origin.name}</strong> · 직선거리순 · 출처 서울시 bikeList
      </p>

      <div className="chips" role="group" aria-label="검색 반경">
        {RADIUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`chip${radius === opt.value ? " is-on" : ""}`}
            onClick={() => props.onRadiusChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="row-between">
        <label className="check">
          <input
            type="checkbox"
            checked={props.onlyAvailable}
            onChange={(e) => props.onOnlyAvailableChange(e.target.checked)}
          />
          대여 가능만 보기
        </label>
        <button type="button" className="btn-text" onClick={props.onRefresh} disabled={loading}>
          새로고침
        </button>
      </div>

      {loading && <p className="status">대여소 정보를 불러오는 중…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && data && stations.length === 0 && (
        <p className="status">조건에 맞는 대여소가 없습니다. 반경을 넓혀 보세요.</p>
      )}

      {!loading && shown.length > 0 && (
        <ul className="station-list">
          {shown.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={s.id === selectedId ? "is-selected" : undefined}
                onClick={() => props.onSelect(s)}
              >
                <span className="station-name">
                  {s.name}
                  <small>
                    {s.no && `${s.no}번 · `}
                    {formatDistance(s.distance)}
                  </small>
                </span>
                <span className={`bike-count${s.bikes === 0 ? " is-empty" : s.bikes < 3 ? " is-low" : ""}`}>
                  {s.bikes}
                  <small>대</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="footnote">
        {data && `조회 ${formatKst(data.fetchedAt)} · `}
        API가 측정시각을 주지 않아 서버 조회시각을 표시합니다. 현장 수량과 다를 수 있어요.
        {stations.length > shown.length && ` 목록은 가까운 ${shown.length}곳만 보여줍니다.`}
      </p>
    </section>
  );
}
