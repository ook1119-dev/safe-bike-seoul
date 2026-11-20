"use client";

import { useEffect, useState } from "react";

export class ApiError extends Error {
  detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.detail = detail;
  }
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.error ?? `요청 실패 (HTTP ${res.status})`, body?.detail);
  }
  return body as T;
}

type LoadState<T> = { key: string; data?: T; error?: ApiError };

// url이 바뀌거나 reloadKey가 바뀌면 다시 불러온다. url이 null이면 요청하지 않음
export function useApi<T>(url: string | null, reloadKey = 0) {
  const key = url ? `${url}#${reloadKey}` : "";
  const [state, setState] = useState<LoadState<T>>({ key: "" });

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    getJson<T>(url, controller.signal)
      .then((data) => setState({ key, data }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({ key, error: err instanceof ApiError ? err : new ApiError("네트워크 오류가 발생했습니다.") });
      });
    return () => controller.abort();
  }, [url, key]);

  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: Boolean(url) && !current,
  };
}

const timeFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const hourFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "numeric",
  hour12: false,
});

export function formatKst(iso?: string | null) {
  if (!iso) return "—";
  return timeFormat.format(new Date(iso));
}

export function formatHour(iso: string) {
  return hourFormat.format(new Date(iso));
}

export function formatMinutes(seconds: number) {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
}
