'use client';

/**
 * Small, dependency-free chart kit for admin analytics.
 * Single-series only (one hue, no legend — the panel title names the series),
 * thin marks with 4px rounded data ends on a shared baseline, 2px surface gaps,
 * recessive gridlines, per-mark hover/focus tooltips, and a table view for every chart.
 * Labels are rendered as React text (never innerHTML).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';

const SERIES = '#0B5D3B'; // brand green, single series
const SERIES_HOVER = '#138a58';
const GRID = '#ececea';
const INK_MUTED = '#8a8984';

export interface Point {
  label: string;
  value: number;
  /** Shown in the tooltip / table instead of the raw value. */
  display?: string;
  /** Optional second line in the tooltip. */
  note?: string;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function TableView({ points, valueLabel }: { points: Point[]; valueLabel: string }) {
  return (
    <details className="mt-2 text-[11px] text-gray-600">
      <summary className="cursor-pointer select-none font-semibold text-gray-500 hover:text-gray-800">View as table</summary>
      <div className="mt-1 max-h-56 overflow-auto rounded-lg border border-gray-100">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
            <tr>
              <th className="px-2 py-1 font-semibold">Label</th>
              <th className="px-2 py-1 text-right font-semibold">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.label} className="border-t border-gray-50">
                <td className="px-2 py-1">{p.label}</td>
                <td className="px-2 py-1 text-right tabular-nums">{p.display ?? p.value.toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const shortINR = (paise: number) => {
  const r = paise / 100;
  return r >= 100000 ? `₹${(r / 100000).toFixed(1)}L` : r >= 1000 ? `₹${(r / 1000).toFixed(1)}k` : `₹${Math.round(r)}`;
};

/** Vertical columns. `tickFormat` is a name (not a function) so Server Components can render it. */
export function ColumnChart({ points, valueLabel, tickFormat = 'number', height = 180, ariaLabel }: { points: Point[]; valueLabel: string; tickFormat?: 'number' | 'inr'; height?: number; ariaLabel: string }) {
  const formatTick = (v: number) => (tickFormat === 'inr' ? shortINR(v) : Number.isInteger(v) ? v.toLocaleString('en-IN') : v.toFixed(1));
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => niceMax(Math.max(0, ...points.map((p) => p.value))), [points]);
  // Draw in real pixels (viewBox = measured width) so text stays 10px at every screen size.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const padL = 48;
  const padB = 22;
  const padT = 8;
  const plotW = W - padL - 8;
  const plotH = height - padB - padT;
  const slot = plotW / Math.max(1, points.length);
  const barW = Math.max(2, Math.min(24, slot - 2)); // ≤24px, 2px surface gap
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(points.length / Math.max(2, Math.floor(plotW / 64)));
  const empty = points.every((p) => p.value === 0);
  const hp = hover != null ? points[hover] : null;

  return (
    <div className="relative" ref={box}>
      <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} className="block max-w-full" role="img" aria-label={ariaLabel} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => {
          const y = padT + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={padL} x2={W - 8} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={10} fill={INK_MUTED}>
                {formatTick(t)}
              </text>
            </g>
          );
        })}
        {points.map((p, i) => {
          const h = (p.value / max) * plotH;
          const x = padL + i * slot + (slot - barW) / 2;
          const y = padT + plotH - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={p.label}>
              {h > 0 && (
                <path
                  d={`M${x},${padT + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${padT + plotH} Z`}
                  fill={hover === i ? SERIES_HOVER : SERIES}
                />
              )}
              {/* Hit target: the whole column slot, not just the painted bar */}
              <rect
                x={padL + i * slot}
                y={padT}
                width={slot}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${p.label}: ${p.display ?? p.value}`}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                style={{ outline: 'none' }}
              />
              {i % labelEvery === 0 && (
                <text x={padL + i * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize={10} fill={INK_MUTED}>
                  {p.label.length > 5 ? p.label.slice(5) : p.label}
                </text>
              )}
            </g>
          );
        })}
        <line x1={padL} x2={W - 8} y1={padT + plotH} y2={padT + plotH} stroke="#d6d5d1" strokeWidth={1} />
      </svg>
      {empty && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-gray-400">No data in this range</p>}
      {hp && hover != null && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] shadow-md"
          style={{ left: `clamp(0px, calc(${((padL + hover * slot + slot / 2) / W) * 100}% - 60px), calc(100% - 140px))` }}
          role="status"
        >
          <p className="font-black tabular-nums text-gray-900">{hp.display ?? hp.value.toLocaleString('en-IN')}</p>
          <p className="text-gray-500">{hp.label}</p>
          {hp.note && <p className="text-gray-500">{hp.note}</p>}
        </div>
      )}
      <TableView points={points} valueLabel={valueLabel} />
    </div>
  );
}

/** Ranked horizontal bars with direct value labels (top-N lists). */
export function BarList({ points, valueLabel, empty = 'No data yet' }: { points: Point[]; valueLabel: string; empty?: string }) {
  const max = Math.max(0, ...points.map((p) => p.value));
  if (!points.length || max === 0) return <p className="py-4 text-center text-[11px] text-gray-400">{empty}</p>;
  return (
    <div>
      <ul className="space-y-1.5" aria-label={valueLabel}>
        {points.map((p) => (
          <li key={p.label} className="group" title={p.note ? `${p.label} — ${p.note}` : p.label}>
            <div className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate text-gray-700">{p.label}</span>
              <span className="shrink-0 font-bold tabular-nums text-gray-900">{p.display ?? p.value.toLocaleString('en-IN')}</span>
            </div>
            <div className="mt-0.5 h-2 w-full rounded-sm bg-gray-100">
              <div className="h-2 rounded-r-[4px] transition-colors group-hover:opacity-80" style={{ width: `${Math.max(1.5, (p.value / max) * 100)}%`, background: SERIES }} />
            </div>
            {p.note && <p className="text-[10px] text-gray-400">{p.note}</p>}
          </li>
        ))}
      </ul>
      <TableView points={points} valueLabel={valueLabel} />
    </div>
  );
}
