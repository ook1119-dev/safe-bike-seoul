"use client";

import { useEffect, useRef, useState } from "react";
import type { PathPoint } from "@/lib/geo";
import { loadKakaoMaps } from "@/lib/kakao-loader";
import type { Hotspot, Place, RouteMode, StationWithDistance } from "@/lib/types";

type MapRoute = { mode: RouteMode; path: PathPoint[] };

type Props = {
  origin: Place;
  destination: Place | null;
  stations: StationWithDistance[];
  selectedStationId: string | null;
  onSelectStation: (station: StationWithDistance) => void;
  routes: MapRoute[];
  activeMode: RouteMode;
  hotspots: Hotspot[];
  focus: { lat: number; lng: number; seq: number } | null;
};

type MapCtx = { sdk: typeof kakao.maps; map: kakao.maps.Map };

const ROUTE_COLOR: Record<RouteMode, string> = {
  BIKE_ONLY: "#0f8a5f",
  SHORTEST: "#2f6fde",
};

const APP_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

function pin(label: string, className: string) {
  const el = document.createElement("div");
  el.className = `map-pin ${className}`;
  el.textContent = label;
  return el;
}

export default function KakaoMap(props: Props) {
  const { origin, destination, stations, selectedStationId, onSelectStation, routes, activeMode, hotspots, focus } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const initialCenter = useRef(origin);
  const [ctx, setCtx] = useState<MapCtx | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!APP_KEY) return;
    let cancelled = false;

    loadKakaoMaps(APP_KEY)
      .then(({ maps }) => {
        if (cancelled || !containerRef.current) return;
        const { lat, lng } = initialCenter.current;
        const map = new maps.Map(containerRef.current, { center: new maps.LatLng(lat, lng), level: 5 });
        map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
        setCtx({ sdk: maps, map });
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(
          `카카오 지도를 불러오지 못했습니다. JavaScript 키가 맞는지, Kakao Developers의 JavaScript SDK 도메인에 ${window.location.origin} 이 등록되어 있는지 확인하세요.`,
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 출발지 · 도착지 표시
  useEffect(() => {
    if (!ctx) return;
    const { sdk, map } = ctx;
    const overlays = [
      new sdk.CustomOverlay({
        map,
        position: new sdk.LatLng(origin.lat, origin.lng),
        content: pin("출발", "is-origin"),
        yAnchor: 1.15,
        zIndex: 30,
      }),
    ];
    if (destination) {
      overlays.push(
        new sdk.CustomOverlay({
          map,
          position: new sdk.LatLng(destination.lat, destination.lng),
          content: pin("도착", "is-dest"),
          yAnchor: 1.15,
          zIndex: 30,
        }),
      );
    }
    return () => overlays.forEach((o) => o.setMap(null));
  }, [ctx, origin, destination]);

  useEffect(() => {
    if (!ctx) return;
    ctx.map.panTo(new ctx.sdk.LatLng(origin.lat, origin.lng));
  }, [ctx, origin]);

  // 따릉이 대여소
  useEffect(() => {
    if (!ctx) return;
    const { sdk, map } = ctx;

    const overlays = stations.map((station) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "station-marker";
      if (station.bikes === 0) el.classList.add("is-empty");
      else if (station.bikes < 3) el.classList.add("is-low");
      if (station.id === selectedStationId) el.classList.add("is-selected");
      el.textContent = String(station.bikes);
      el.title = `${station.name} · 자전거 ${station.bikes}대`;
      el.addEventListener("click", () => onSelectStation(station));

      return new sdk.CustomOverlay({
        map,
        position: new sdk.LatLng(station.lat, station.lng),
        content: el,
        clickable: true,
        zIndex: station.id === selectedStationId ? 25 : 10,
      });
    });

    return () => overlays.forEach((o) => o.setMap(null));
  }, [ctx, stations, selectedStationId, onSelectStation]);

  // 사고다발지역 (폴리곤이 없으면 중심점 기준 원으로)
  useEffect(() => {
    if (!ctx) return;
    const { sdk, map } = ctx;
    const shapes: kakao.maps.Overlay[] = [];

    for (const spot of hotspots) {
      const style = {
        map,
        strokeWeight: 1.5,
        strokeColor: "#d63b3b",
        strokeOpacity: 0.8,
        fillColor: "#e5484d",
        fillOpacity: 0.22,
        zIndex: 3,
      };
      if (spot.polygon && spot.polygon.length > 2) {
        shapes.push(new sdk.Polygon({ ...style, path: spot.polygon.map(([x, y]) => new sdk.LatLng(y, x)) }));
      } else {
        shapes.push(new sdk.Circle({ ...style, center: new sdk.LatLng(spot.lat, spot.lng), radius: 60 }));
      }

      const dot = document.createElement("div");
      dot.className = "hotspot-dot";
      dot.title = `${spot.name}\n사고 ${spot.accidents}건 · 사상자 ${spot.casualties}명 (사망 ${spot.deaths})`;
      shapes.push(
        new sdk.CustomOverlay({ map, position: new sdk.LatLng(spot.lat, spot.lng), content: dot, zIndex: 5 }),
      );
    }

    return () => shapes.forEach((s) => s.setMap(null));
  }, [ctx, hotspots]);

  // 경로 (선택한 경로를 위에 진하게)
  useEffect(() => {
    if (!ctx) return;
    const { sdk, map } = ctx;

    const lines = routes.map((route) => {
      const active = route.mode === activeMode;
      return new sdk.Polyline({
        map,
        path: route.path.map(([x, y]) => new sdk.LatLng(y, x)),
        strokeWeight: active ? 6 : 4,
        strokeColor: active ? ROUTE_COLOR[route.mode] : "#8a96a3",
        strokeOpacity: active ? 0.9 : 0.6,
        strokeStyle: active ? "solid" : "shortdash",
        zIndex: active ? 20 : 15,
      });
    });

    return () => lines.forEach((l) => l.setMap(null));
  }, [ctx, routes, activeMode]);

  // 새 경로가 들어오면 화면을 경로에 맞춤
  useEffect(() => {
    if (!ctx || routes.length === 0) return;
    const bounds = new ctx.sdk.LatLngBounds();
    routes.forEach((r) => r.path.forEach(([x, y]) => bounds.extend(new ctx.sdk.LatLng(y, x))));
    if (!bounds.isEmpty()) ctx.map.setBounds(bounds, 40, 40, 40, 40);
  }, [ctx, routes]);

  useEffect(() => {
    if (!ctx || !focus) return;
    ctx.map.setLevel(3);
    ctx.map.panTo(new ctx.sdk.LatLng(focus.lat, focus.lng));
  }, [ctx, focus]);

  const message = !APP_KEY
    ? "NEXT_PUBLIC_KAKAO_JS_KEY 환경변수가 없어 지도를 표시할 수 없습니다."
    : loadError;

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map" />
      {!ctx && (
        <div className={`map-overlay${message ? " is-error" : ""}`}>
          {message ?? "카카오 지도를 불러오는 중입니다…"}
        </div>
      )}
      <div className="map-legend">
        <span><i className="lg-station" />따릉이</span>
        <span><i className="lg-hotspot" />과거 사고다발지역</span>
        <span><i className="lg-bike" />자전거도로 우선</span>
        <span><i className="lg-short" />최단 경로</span>
      </div>
    </div>
  );
}
