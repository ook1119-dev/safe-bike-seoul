"use client";

export const NEAR_RADIUS_OPTIONS = [100, 300, 500, 1000];

export default function RadiusPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="chips" role="group" aria-label="사고다발지역 집계 반경">
      {NEAR_RADIUS_OPTIONS.map((r) => (
        <button
          key={r}
          type="button"
          className={`chip${value === r ? " is-on" : ""}`}
          onClick={() => onChange(r)}
        >
          {r >= 1000 ? `${r / 1000}km` : `${r}m`}
        </button>
      ))}
    </div>
  );
}
