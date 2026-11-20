"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { formatKst, formatMinutes, getJson, useApi, ApiError } from "@/lib/client";
import { distanceM, distanceToPath, formatDistance } from "@/lib/geo";
import type {
  BikeRoute,
  Forecast,
  HotspotData,
  Place,
  RouteMode,
  RouteResult,
  StationsResponse,
  StationWithDistance,
} from "@/lib/types";
import HotspotCard from "./HotspotCard";
import KakaoMap from "./KakaoMap";
import PlaceSearch from "./PlaceSearch";
import RouteCompare, { MODE_LABEL } from "./RouteCompare";
import SourceTable, { type SourceRow } from "./SourceTable";
import StationPanel from "./StationPanel";
import WeatherCard, { describeSky } from "./WeatherCard";

const DEFAULT_ORIGIN: Place = {
  name: "여의도한강공원",
  address: "서울 영등포구 여의동로 330",
  lat: 37.52845,
  lng: 126.93277,
};

const MODES: RouteMode[] = ["BIKE_ONLY", "SHORTEST"];

type Routes = Partial<Record<RouteMode, RouteResult>>;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  );
}

export default function SafeBikeApp() {
  const [origin, setOrigin] = useState<Place>(DEFAULT_ORIGIN);
  const [destination, setDestination] = useState<Place | null>(null);
  const [radius, setRadius] = useState(1000);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selected, setSelected] = useState<StationWithDistance | null>(null);
  const [routes, setRoutes] = useState<Routes | null>(null);
  const [activeMode, setActiveMode] = useState<RouteMode>("BIKE_ONLY");
  const [nearRadius, setNearRadius] = useState(300);
  const [onlyNearRoute, setOnlyNearRoute] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number; seq: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [reload, setReload] = useState({ stations: 0, weather: 0, hotspots: 0 });
  const routeRequest = useRef(0);

  const lat = origin.lat.toFixed(5);
  const lng = origin.lng.toFixed(5);
  const stationsApi = useApi<StationsResponse>(`/api/stations?lat=${lat}&lng=${lng}&radius=${radius}`, reload.stations);
  const weatherApi = useApi<Forecast>(`/api/weather?lat=${lat}&lng=${lng}`, reload.weather);
  const hotspotApi = useApi<HotspotData>(
    reload.hotspots > 0 ? "/api/hotspots?refresh=1" : "/api/hotspots",
    reload.hotspots,
  );

  const allStations = stationsApi.data?.stations;
  const stations = useMemo(() => {
    const list = allStations ?? [];
    return onlyAvailable ? list.filter((s) => s.bikes > 0) : list;
  }, [allStations, onlyAvailable]);

  // 새로고침하면 선택한 대여소의 수량도 최신 값으로
  const station = selected ? (allStations?.find((s) => s.id === selected.id) ?? selected) : null;

  const okRoutes = useMemo(
    () =>
      MODES.flatMap((mode) => {
        const r = routes?.[mode];
        return r?.status === "ok" ? [{ mode, path: r.data.path, data: r.data }] : [];
      }),
    [routes],
  );
  const mapRoutes = useMemo(() => okRoutes.map(({ mode, path }) => ({ mode, path })), [okRoutes]);

  // 선택한 옵션이 실패했으면 성공한 쪽을 보여준다
  const shownMode = okRoutes.some((r) => r.mode === activeMode) ? activeMode : (okRoutes[0]?.mode ?? activeMode);
  const activeRoute = okRoutes.find((r) => r.mode === shownMode);

  const hotspots = hotspotApi.data?.hotspots;

  const nearCounts = useMemo(() => {
    const counts: Partial<Record<RouteMode, number>> = {};
    if (!hotspots) return counts;
    for (const r of okRoutes) {
      counts[r.mode] = hotspots.filter((h) => distanceToPath(h, r.path) <= nearRadius).length;
    }
    return counts;
  }, [okRoutes, hotspots, nearRadius]);

  const nearList = useMemo(() => {
    if (!hotspots) return [];
    return hotspots
      .map((h) => ({ ...h, distance: activeRoute ? distanceToPath(h, activeRoute.path) : distanceM(origin, h) }))
      .filter((h) => h.distance <= nearRadius)
      .sort((a, b) => a.distance - b.distance);
  }, [hotspots, activeRoute, origin, nearRadius]);

  const mapHotspots = useMemo(
    () => (onlyNearRoute && activeRoute ? nearList : (hotspots ?? [])),
    [onlyNearRoute, activeRoute, nearList, hotspots],
  );

  const fetchRoutes = useCallback((from: Place, to: Place) => {
    const id = ++routeRequest.current;
    setRoutes({ BIKE_ONLY: { status: "loading" }, SHORTEST: { status: "loading" } });

    for (const mode of MODES) {
      const qs = new URLSearchParams({
        sx: String(from.lng),
        sy: String(from.lat),
        ex: String(to.lng),
        ey: String(to.lat),
        mode,
        sname: from.name,
        ename: to.name,
      });
      getJson<BikeRoute>(`/api/directions?${qs}`)
        .then((data) => {
          if (id === routeRequest.current) setRoutes((prev) => ({ ...prev, [mode]: { status: "ok", data } }));
        })
        .catch((err) => {
          if (id !== routeRequest.current) return;
          const e = err instanceof ApiError ? err : new ApiError("경로 요청에 실패했습니다.");
          setRoutes((prev) => ({
            ...prev,
            [mode]: { status: "error", error: e.message, detail: e.detail, at: new Date().toISOString() },
          }));
        });
    }
  }, []);

  const clearRoutes = () => {
    routeRequest.current++;
    setRoutes(null);
  };

  const selectStation = useCallback(
    (s: StationWithDistance) => {
      setSelected(s);
      setNotice(null);
      if (destination) {
        fetchRoutes(s, destination);
      } else {
        routeRequest.current++;
        setRoutes(null);
      }
    },
    [destination, fetchRoutes],
  );

  function changeOrigin(place: Place) {
    setOrigin(place);
    setSelected(null);
    setNotice(null);
    clearRoutes();
  }

  function changeDestination(place: Place) {
    setDestination(place);
    setNotice(null);
    if (station) fetchRoutes(station, place);
    else clearRoutes();
  }

  function handleFindRoute() {
    if (!destination) {
      setNotice("목적지를 먼저 검색해서 선택하세요.");
      return;
    }
    let from = station;
    if (!from) {
      from = allStations?.find((s) => s.bikes > 0) ?? null;
      if (!from) {
        setNotice("주변에 대여 가능한 대여소가 없습니다. 반경을 넓혀 보세요.");
        return;
      }
      setSelected(from);
      setNotice(`가장 가까운 대여 가능 대여소(${from.name})를 출발 대여소로 골랐어요. 목록에서 바꿀 수 있습니다.`);
    }
    fetchRoutes(from, destination);
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setNotice("이 브라우저는 위치 기능을 지원하지 않습니다.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        changeOrigin({ name: "현재 위치", lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setNotice("현재 위치를 가져오지 못했습니다. 브라우저의 위치 권한을 확인하세요.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const bump = (key: keyof typeof reload) => setReload((r) => ({ ...r, [key]: r[key] + 1 }));

  // ----- 요약 -----
  const forecast = weatherApi.data;
  const radiusText = formatDistance(nearRadius);
  const routeLoading = routes ? MODES.some((m) => routes[m]?.status === "loading") : false;
  const routeErrors = routes ? MODES.map((m) => routes[m]).filter((r) => r?.status === "error") : [];

  let summary = "출발 대여소를 고르고 목적지를 정하면 경로 요약이 여기에 표시됩니다.";
  if (station && !destination) {
    summary = `${station.name} 대여소를 골랐습니다(자전거 ${station.bikes}대). 목적지를 검색하면 경로를 조회합니다.`;
  } else if (routeLoading && !activeRoute) {
    summary = "카카오 자전거 경로를 조회하는 중입니다…";
  } else if (routes && !routeLoading && okRoutes.length === 0) {
    const first = routeErrors[0];
    summary = `자전거 경로를 조회하지 못했습니다. ${first?.status === "error" ? first.error : ""} 임의로 만든 경로는 표시하지 않습니다.`;
  } else if (activeRoute && station && destination) {
    const other = okRoutes.find((r) => r.mode !== activeRoute.mode);
    const count = nearCounts[activeRoute.mode];
    summary =
      `${station.name}에서 ${destination.name}까지 ${MODE_LABEL[activeRoute.mode]} 경로는 ` +
      `${formatDistance(activeRoute.data.distance)}, 약 ${formatMinutes(activeRoute.data.duration)} 걸립니다. ` +
      (count !== undefined ? `경로 ${radiusText} 이내 과거 사고다발지역은 ${count}곳입니다. ` : "") +
      (other
        ? `${MODE_LABEL[other.mode]} 경로는 ${formatDistance(other.data.distance)}` +
          (nearCounts[other.mode] !== undefined ? `, 사고다발지역 ${nearCounts[other.mode]}곳입니다. ` : "입니다. ")
        : "") +
      (forecast ? `출발지 예보는 ${forecast.current.tmp}°, 강수확률 ${forecast.current.pop}%입니다.` : "");
  }

  // ----- 출처 표 -----
  const routeStatus: SourceRow["status"] = !routes
    ? "idle"
    : routeLoading
      ? "loading"
      : okRoutes.length === MODES.length
        ? "ok"
        : okRoutes.length > 0
          ? "partial"
          : "error";

  const apiStatus = (api: { loading: boolean; error?: unknown; data?: unknown }): SourceRow["status"] =>
    api.loading ? "loading" : api.error ? "error" : api.data ? "ok" : "idle";

  const sourceRows: SourceRow[] = [
    {
      label: "따릉이 재고",
      source: "서울 열린데이터광장 bikeList",
      href: "https://data.seoul.go.kr/dataList/OA-15493/A/1/datasetView.do",
      basis: "실시간 현황 (측정시각 미제공)",
      fetchedAt: formatKst(stationsApi.data?.fetchedAt),
      status: apiStatus(stationsApi),
    },
    {
      label: "자전거 경로",
      source: "카카오맵 자전거 경로 API",
      href: "https://developers.kakao.com/docs/ko/kakaomap/rest-api",
      basis: "조회 시점 기준",
      fetchedAt: formatKst(okRoutes[0]?.data.fetchedAt),
      status: routeStatus,
    },
    {
      label: "사고다발지역",
      source: "한국도로교통공단 (공공데이터포털)",
      href: "https://www.data.go.kr/data/15056681/openapi.do",
      basis: hotspotApi.data ? `${hotspotApi.data.year}년 사고 통계` : "—",
      fetchedAt: formatKst(hotspotApi.data?.fetchedAt),
      status: apiStatus(hotspotApi),
    },
    {
      label: "출발지 날씨",
      source: "기상청 단기예보",
      href: "https://www.data.go.kr/data/15084084/openapi.do",
      basis: forecast ? `발표 ${formatKst(forecast.issuedAt)} / 예보 ${formatKst(forecast.current.at)}` : "—",
      fetchedAt: formatKst(forecast?.fetchedAt),
      status: apiStatus(weatherApi),
    },
  ];

  return (
    <>
      <header className="site-header">
        <div className="inner">
          <a href="#top" className="brand">
            <span className="brand-mark" aria-hidden="true">SB</span>
            Safe Bike Seoul
          </a>
          <nav>
            <a href="#route-panel">길찾기</a>
            <a href="#comparison">경로 비교</a>
            <a href="#stations">따릉이</a>
            <a href="#safety">사고·날씨</a>
            <a href="#sources">출처</a>
          </nav>
        </div>
      </header>

      <main className="page" id="top">
        <section className="hero">
          <p className="eyebrow">Seoul Bike · Plan your ride</p>
          <h1>오늘은 어디로 달려볼까요?</h1>
          <p className="lead">
            출발지 근처 따릉이 대여소를 고르고, 목적지까지 자전거도로 우선 경로와 최단 경로를 비교해 보세요.
            경로 주변의 과거 사고다발지역과 출발지 날씨도 함께 보여줍니다.
          </p>
          <p className="disclaimer">
            공공데이터를 모아서 비교해 보여줄 뿐, 경로의 실제 안전성을 판단하거나 보장하지 않습니다.
          </p>
        </section>

        <div className="layout">
          <div className="side">
            <section className="card" id="route-panel">
              <h2>자전거 길찾기</h2>
              <PlaceSearch id="origin" label="출발지" placeholder="예: 여의나루역" value={origin} onSelect={changeOrigin}>
                <button type="button" className="btn-text" onClick={locateMe} disabled={locating}>
                  {locating ? "위치 확인 중…" : "현재 위치 사용"}
                </button>
              </PlaceSearch>
              <PlaceSearch
                id="destination"
                label="목적지"
                placeholder="예: 서울숲"
                value={destination}
                onSelect={changeDestination}
              />

              <div className="picked-station">
                <span className="muted">출발 대여소</span>
                {station ? (
                  <strong>
                    {station.name} · {station.bikes}대
                  </strong>
                ) : (
                  <span className="muted">목록이나 지도에서 선택</span>
                )}
              </div>

              <button type="button" className="btn btn-primary btn-block" onClick={handleFindRoute}>
                자전거 경로 찾기
              </button>
              {notice && <p className="notice">{notice}</p>}
            </section>

            <StationPanel
              origin={origin}
              radius={radius}
              onRadiusChange={setRadius}
              onlyAvailable={onlyAvailable}
              onOnlyAvailableChange={setOnlyAvailable}
              data={stationsApi.data}
              stations={stations}
              loading={stationsApi.loading}
              error={stationsApi.error?.message}
              selectedId={station?.id ?? null}
              onSelect={selectStation}
              onRefresh={() => bump("stations")}
            />
          </div>

          <div className="main-col">
            <KakaoMap
              origin={origin}
              destination={destination}
              stations={stations}
              selectedStationId={station?.id ?? null}
              onSelectStation={selectStation}
              routes={mapRoutes}
              activeMode={shownMode}
              hotspots={mapHotspots}
              focus={focus}
            />

            <div className="stats">
              <Stat
                label="대여 가능 수량"
                value={station ? `${station.bikes}대` : "대여소 선택"}
                sub={station ? station.name : "목록이나 지도에서 고르세요"}
              />
              <Stat
                label="선택 경로 거리"
                value={activeRoute ? formatDistance(activeRoute.data.distance) : routeLoading ? "조회 중" : "경로 미조회"}
                sub={activeRoute ? `${MODE_LABEL[activeRoute.mode]} · ${formatMinutes(activeRoute.data.duration)}` : MODE_LABEL[shownMode]}
              />
              <Stat
                label="주변 사고다발지역"
                value={activeRoute && nearCounts[activeRoute.mode] !== undefined ? `${nearCounts[activeRoute.mode]}곳` : "분석 대기"}
                sub={`경로 ${radiusText} 이내 기준`}
              />
              <Stat
                label="출발지 기상예보"
                value={forecast ? `${forecast.current.tmp}°` : weatherApi.loading ? "조회 중" : "—"}
                sub={
                  forecast
                    ? `${describeSky(forecast.current.pty, forecast.current.sky)} · 강수확률 ${forecast.current.pop}%`
                    : "기온 · 강수확률"
                }
              />
            </div>

            <section className="card route-summary">
              <h2>경로 요약</h2>
              <p>{summary}</p>
            </section>
          </div>
        </div>

        <RouteCompare
          routes={routes}
          nearCounts={nearCounts}
          hotspotsReady={Boolean(hotspots)}
          activeMode={shownMode}
          onActivate={setActiveMode}
          radius={nearRadius}
          onRadiusChange={setNearRadius}
        />

        <div className="two-col" id="safety">
          <WeatherCard
            place={origin}
            data={forecast}
            loading={weatherApi.loading}
            error={weatherApi.error?.message}
            onRefresh={() => bump("weather")}
          />
          <HotspotCard
            data={hotspotApi.data}
            loading={hotspotApi.loading}
            error={hotspotApi.error?.message}
            hasRoute={Boolean(activeRoute)}
            list={nearList}
            radius={nearRadius}
            onRadiusChange={setNearRadius}
            onlyNearRoute={onlyNearRoute}
            onOnlyNearRouteChange={setOnlyNearRoute}
            onFocus={(spot) => {
              setFocus((f) => ({ lat: spot.lat, lng: spot.lng, seq: (f?.seq ?? 0) + 1 }));
              document.querySelector(".map-wrap")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            onReload={() => bump("hotspots")}
          />
        </div>

        <SourceTable rows={sourceRows} />
      </main>

      <footer className="site-footer">
        <div className="inner">
          <strong>SAFE BIKE SEOUL</strong>
          <p>
            서울 열린데이터광장 · 한국도로교통공단 · 기상청 · 카카오맵 데이터를 모아 비교해서 보여주는 서울 자전거 지도입니다.
            실제 안전이나 주행 가능 여부를 보장하지 않으니 현장 상황을 꼭 확인하세요.
          </p>
        </div>
      </footer>
    </>
  );
}
