"use client";

import { formatKst } from "@/lib/client";
import { formatDistance } from "@/lib/geo";
import type { Hotspot, HotspotData } from "@/lib/types";
import RadiusPicker from "./RadiusPicker";

type NearSpot = Hotspot & { distance: number };

type Props = {
  data?: HotspotData;
  loading: boolean;
  error?: string;
  hasRoute: boolean;
  list: NearSpot[];
  radius: number;
  onRadiusChange: (r: number) => void;
  onlyNearRoute: boolean;
  onOnlyNearRouteChange: (v: boolean) => void;
  onFocus: (spot: Hotspot) => void;
  onReload: () => void;
};

export default function HotspotCard(props: Props) {
  const { data, loading, error, hasRoute, list } = props;

  return (
    <section className="card">
      <div className="card-head">
        <h2>자전거 사고다발지역</h2>
        <span className="tag is-warn">과거 통계</span>
      </div>
      <p className="card-sub">
        {data
          ? `${data.year}년 한 해 동안 자전거 사고가 몰렸던 곳입니다. (서울 ${data.hotspots.length}곳)`
          : "한국도로교통공단이 공개한 가장 최근 연도의 자료를 사용합니다."}{" "}
        실시간 정보가 아닙니다.
      </p>

      <RadiusPicker value={props.radius} onChange={props.onRadiusChange} />

      <div className="row-between">
        <label className="check">
          <input
            type="checkbox"
            checked={props.onlyNearRoute}
            disabled={!hasRoute}
            onChange={(e) => props.onOnlyNearRouteChange(e.target.checked)}
          />
          지도에 경로 주변만 표시
        </label>
        <button type="button" className="btn-text" onClick={props.onReload} disabled={loading}>
          다시 조회
        </button>
      </div>

      {loading && <p className="status">최신 연도 자료를 확인하는 중… (처음엔 조금 걸려요)</p>}
      {error && <p className="error-text">{error}</p>}

      {data && !loading && (
        <>
          <p className="list-title">
            {hasRoute ? "선택한 경로 주변" : "출발지 주변"} {formatDistance(props.radius)} 이내 · {list.length}곳
          </p>
          {list.length === 0 ? (
            <p className="status">범위 안에 사고다발지역이 없습니다.</p>
          ) : (
            <ul className="hotspot-list">
              {list.slice(0, 8).map((spot) => (
                <li key={spot.id}>
                  <button type="button" onClick={() => props.onFocus(spot)}>
                    <span>
                      <strong>{spot.name}</strong>
                      <small>
                        {spot.district} · {hasRoute ? "경로에서" : "출발지에서"} {formatDistance(spot.distance)}
                      </small>
                    </span>
                    <span className="hotspot-stat">
                      사고 {spot.accidents}건
                      <small>
                        사상자 {spot.casualties} · 사망 {spot.deaths}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="footnote">
            서버 조회 {formatKst(data.fetchedAt)} · 확인한 연도 {data.checkedYears.join(", ")}
          </p>
        </>
      )}
    </section>
  );
}
