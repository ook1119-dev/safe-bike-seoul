"use client";

import { formatKst, formatMinutes } from "@/lib/client";
import { formatDistance } from "@/lib/geo";
import type { RouteMode, RouteResult } from "@/lib/types";
import RadiusPicker from "./RadiusPicker";

export const MODE_LABEL: Record<RouteMode, string> = {
  BIKE_ONLY: "자전거도로 우선",
  SHORTEST: "최단 경로",
};

type Props = {
  routes: Partial<Record<RouteMode, RouteResult>> | null;
  nearCounts: Partial<Record<RouteMode, number>>;
  hotspotsReady: boolean;
  activeMode: RouteMode;
  onActivate: (mode: RouteMode) => void;
  radius: number;
  onRadiusChange: (r: number) => void;
};

export default function RouteCompare({ routes, nearCounts, hotspotsReady, activeMode, onActivate, radius, onRadiusChange }: Props) {
  const modes = Object.keys(MODE_LABEL) as RouteMode[];

  return (
    <section className="card" id="comparison">
      <div className="card-head">
        <h2>경로 비교</h2>
        <RadiusPicker value={radius} onChange={onRadiusChange} />
      </div>
      <p className="card-sub">
        카카오 자전거 경로 API 결과와 경로 {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`} 이내 과거 사고다발지역 수를
        나란히 보여줍니다.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>경로 옵션</th>
              <th>거리</th>
              <th>예상 소요</th>
              <th>주변 사고다발지역</th>
              <th>조회시각</th>
              <th>지도</th>
            </tr>
          </thead>
          <tbody>
            {modes.map((mode) => {
              const r = routes?.[mode];
              const isActive = mode === activeMode && r?.status === "ok";

              return (
                <tr key={mode} className={isActive ? "is-active" : undefined}>
                  <td>
                    <span className={`mode-dot mode-${mode.toLowerCase()}`} />
                    {MODE_LABEL[mode]}
                  </td>
                  {!r && <td colSpan={5} className="muted">경로 미조회</td>}
                  {r?.status === "loading" && <td colSpan={5} className="muted">조회 중…</td>}
                  {r?.status === "error" && (
                    <td colSpan={5} className="error-text">
                      조회 실패: {r.error}
                      {r.detail && <span className="detail"> ({r.detail})</span>}
                    </td>
                  )}
                  {r?.status === "ok" && (
                    <>
                      <td>{formatDistance(r.data.distance)}</td>
                      <td>{formatMinutes(r.data.duration)}</td>
                      <td>{hotspotsReady ? `${nearCounts[mode] ?? 0}곳` : "—"}</td>
                      <td>{formatKst(r.data.fetchedAt)}</td>
                      <td className="actions">
                        <button
                          type="button"
                          className={`btn-small${isActive ? " is-on" : ""}`}
                          onClick={() => onActivate(mode)}
                        >
                          {isActive ? "표시 중" : "경로 선택"}
                        </button>
                        {r.data.landingUrl && (
                          <a href={r.data.landingUrl} target="_blank" rel="noopener noreferrer">
                            카카오맵
                          </a>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="notes">
        <li>사고다발지역이 적거나 자전거도로 우선이라고 해서 실제로 더 안전하다는 뜻은 아닙니다.</li>
        <li>사고다발지역 중심점과 경로 사이의 직선거리로 셉니다. 현재 도로 상황, 교통량, 공사 정보는 반영하지 않습니다.</li>
        <li>조회에 실패한 경로나 사고정보는 0으로 세지 않고 &quot;—&quot;로 표시합니다.</li>
      </ul>
    </section>
  );
}
