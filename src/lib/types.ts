import type { getForecast } from "./kma";
import type { getBikeRoute, RouteMode } from "./kakao";
import type { Station } from "./seoul-bike";

export type { Hotspot, HotspotData } from "./hotspots";
export type { RouteMode };

export type Place = {
  id?: string;
  name: string;
  address?: string;
  category?: string;
  lat: number;
  lng: number;
};

export type StationWithDistance = Station & { distance: number };

export type StationsResponse = {
  fetchedAt: string;
  totalStations: number;
  matched: number;
  stations: StationWithDistance[];
};

export type Forecast = Awaited<ReturnType<typeof getForecast>>;
export type BikeRoute = Awaited<ReturnType<typeof getBikeRoute>>;

export type RouteResult =
  | { status: "loading" }
  | { status: "ok"; data: BikeRoute }
  | { status: "error"; error: string; detail?: string; at: string };
