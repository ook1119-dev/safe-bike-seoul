"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { getJson } from "@/lib/client";
import type { Place } from "@/lib/types";

type Props = {
  id: string;
  label: string;
  placeholder: string;
  value: Place | null;
  onSelect: (place: Place) => void;
  children?: ReactNode;
};

export default function PlaceSearch({ id, label, placeholder, value, onSelect, children }: Props) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;

    setBusy(true);
    setError(null);
    try {
      const { places } = await getJson<{ places: Place[] }>(`/api/places?q=${encodeURIComponent(q)}`);
      setResults(places);
    } catch (err) {
      setResults(null);
      setError(err instanceof Error ? err.message : "검색에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function choose(place: Place) {
    onSelect(place);
    setText("");
    setResults(null);
  }

  return (
    <div className="place-search">
      <label htmlFor={id}>{label}</label>
      <form className="search-row" onSubmit={handleSubmit}>
        <input
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "검색 중" : "검색"}
        </button>
      </form>
      {children}

      {value && (
        <p className="place-current">
          <span className="dot" />
          <strong>{value.name}</strong>
          {value.address && <span className="muted"> · {value.address}</span>}
        </p>
      )}

      {error && <p className="error-text">{error}</p>}

      {results && (
        <ul className="search-results">
          {results.length === 0 && <li className="empty">검색 결과가 없습니다.</li>}
          {results.map((place) => (
            <li key={place.id ?? `${place.lat},${place.lng}`}>
              <button type="button" onClick={() => choose(place)}>
                <strong>{place.name}</strong>
                <span>{place.address}</span>
              </button>
            </li>
          ))}
          <li className="close">
            <button type="button" onClick={() => setResults(null)}>닫기</button>
          </li>
        </ul>
      )}
    </div>
  );
}
