"use client";

import { formatHour, formatKst } from "@/lib/client";
import type { Forecast, Place } from "@/lib/types";

const PTY: Record<number, string> = { 1: "비", 2: "비/눈", 3: "눈", 4: "소나기" };
const SKY: Record<number, string> = { 1: "맑음", 3: "구름많음", 4: "흐림" };

export function describeSky(pty: number | null, sky: number | null) {
  if (pty && PTY[pty]) return PTY[pty];
  if (sky && SKY[sky]) return SKY[sky];
  return "—";
}

type Props = {
  place: Place;
  data?: Forecast;
  loading: boolean;
  error?: string;
  onRefresh: () => void;
};

export default function WeatherCard({ place, data, loading, error, onRefresh }: Props) {
  const now = data?.current;
  const rainy = now && ((now.pty ?? 0) > 0 || (now.pop ?? 0) >= 60);

  return (
    <section className="card">
      <div className="card-head">
        <h2>라이딩 기상예보</h2>
        <span className="tag">기상청 단기예보</span>
      </div>
      <p className="card-sub">
        위치: <strong>{place.name}</strong>
        {data && ` · 격자 ${data.grid.nx}, ${data.grid.ny}`}
      </p>

      {loading && <p className="status">격자좌표로 바꿔서 예보를 조회하는 중…</p>}
      {error && <p className="error-text">{error}</p>}

      {now && !loading && (
        <>
          <div className="weather-now">
            <div className="temp">{now.tmp ?? "—"}°</div>
            <div>
              <p className="sky">{describeSky(now.pty, now.sky)}</p>
              <p className="muted">
                강수확률 {now.pop ?? "—"}% · 풍속 {now.wsd ?? "—"}m/s · 습도 {now.reh ?? "—"}%
              </p>
            </div>
          </div>
          {rainy && <p className="warn-text">비 소식이 있어요. 노면이 미끄러울 수 있습니다.</p>}

          <ol className="hourly">
            {data.hourly.map((h) => (
              <li key={h.at}>
                <span>{formatHour(h.at)}</span>
                <strong>{h.tmp ?? "—"}°</strong>
                <span className={(h.pop ?? 0) >= 60 ? "pop is-high" : "pop"}>{h.pop ?? "—"}%</span>
              </li>
            ))}
          </ol>

          <dl className="times">
            <div>
              <dt>발표시각</dt>
              <dd>{formatKst(data.issuedAt)}</dd>
            </div>
            <div>
              <dt>예보시각</dt>
              <dd>{formatKst(now.at)}</dd>
            </div>
          </dl>
        </>
      )}

      <div className="row-between">
        <p className="footnote">예보값이며 실제 관측값과 다를 수 있습니다.</p>
        <button type="button" className="btn-text" onClick={onRefresh} disabled={loading}>
          새로고침
        </button>
      </div>
    </section>
  );
}
