"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { CLOSING_HOUR, OPENING_HOUR, SLOT_MINUTES } from "@/lib/shared";

// Slot types and settings
export type Slot = { day: string; time: string | null; hours: number };
type Busy = { start: string; end: string };

export const DURATIONS = [1, 1.5, 2, 3];
const DAYS_AHEAD = 14;

// Date helpers
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function at(day: string, time: string) {
  const [hh, mm] = time.split(":").map(Number);
  const d = parseDay(day);
  d.setHours(hh, mm, 0, 0);
  return d;
}

// Slot to start and end times
export function toRange(slot: Slot): { start: string; end: string } | null {
  if (!slot.day || !slot.time) return null;
  const start = at(slot.day, slot.time);
  return { start: start.toISOString(), end: new Date(start.getTime() + slot.hours * 3_600_000).toISOString() };
}

// Start and end times to a slot
export function slotFrom(start: string | null, end: string | null): Slot | undefined {
  if (!start || !end) return undefined;
  const s = new Date(start);
  const hours = (Date.parse(end) - s.getTime()) / 3_600_000;
  return { day: dayKey(s), time: `${pad(s.getHours())}:${pad(s.getMinutes())}`, hours: DURATIONS.includes(hours) ? hours : 1 };
}

// Readable slot description
export function describeSlot(slot: Slot): string | null {
  const range = toRange(slot);
  if (!range) return null;
  const s = new Date(range.start);
  const e = new Date(range.end);
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${s.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}, ${t(s)} – ${t(e)}`;
}

// Day, duration and time picker using live availability
export function SlotPicker({
  facilityCode,
  value,
  onChange,
  ignore,
}: {
  facilityCode: string;
  value: Slot;
  onChange: (slot: Slot) => void;
  ignore?: { start: string; end: string };
}) {
  const [days, setDays] = useState<Date[]>();
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setDays(Array.from({ length: DAYS_AHEAD }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)));
    if (!value.day) onChange({ ...value, day: dayKey(today) });
  }, []);

  const [busy, setBusy] = useState<Busy[]>();
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    if (!value.day) return;
    const from = parseDay(value.day);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
    let cancelled = false;
    setBusy(undefined);
    setLoadError(false);
    api<{ busy: Busy[] }>(
      `/api/facilities/${encodeURIComponent(facilityCode)}/availability?from=${from.toISOString()}&to=${to.toISOString()}`,
    )
      .then((r) => !cancelled && setBusy(r.busy))
      .catch(() => !cancelled && (setLoadError(true), setBusy([])));
    return () => {
      cancelled = true;
    };
  }, [facilityCode, value.day]);

  const times = useMemo(() => {
    if (!value.day) return [];
    const list: { time: string; state: "free" | "taken" | "past" }[] = [];
    const now = Date.now();
    const intervals = (busy ?? [])
      .filter((b) => !(ignore && Date.parse(b.start) === Date.parse(ignore.start) && Date.parse(b.end) === Date.parse(ignore.end)))
      .map((b) => [Date.parse(b.start), Date.parse(b.end)] as const);
    for (let m = OPENING_HOUR * 60; m + value.hours * 60 <= CLOSING_HOUR * 60; m += SLOT_MINUTES) {
      const time = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
      const start = at(value.day, time).getTime();
      const end = start + value.hours * 3_600_000;
      const state = start <= now ? "past" : intervals.some(([bs, be]) => start < be && end > bs) ? "taken" : "free";
      list.push({ time, state });
    }
    return list;
  }, [busy, value.day, value.hours, ignore]);

  useEffect(() => {
    if (value.time && busy && !times.some((t) => t.time === value.time && t.state === "free")) onChange({ ...value, time: null });
  }, [times]);

  const freeCount = times.filter((t) => t.state === "free").length;

  return (
    <div className="slot-picker">
      <div className="field-label" id="day-label">
        Day
      </div>
      <div className="day-strip" role="radiogroup" aria-labelledby="day-label">
        {days
          ? days.map((d, i) => {
              const key = dayKey(d);
              const selected = key === value.day;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`day-chip${selected ? " is-selected" : ""}`}
                  onClick={() => onChange({ ...value, day: key, time: null })}
                >
                  <span className="dow">{i === 0 ? "Today" : i === 1 ? "Tmrw" : d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                  <span className="dom">{d.getDate()}</span>
                  <span className="mon">{d.toLocaleDateString(undefined, { month: "short" })}</span>
                </button>
              );
            })
          : Array.from({ length: 7 }, (_, i) => <span key={i} className="day-chip skeleton" />)}
      </div>

      <div className="field-label" id="duration-label">
        Duration
      </div>
      <div className="chips" role="radiogroup" aria-labelledby="duration-label">
        {DURATIONS.map((h) => (
          <button
            key={h}
            type="button"
            role="radio"
            aria-checked={value.hours === h}
            className={`chip${value.hours === h ? " is-selected" : ""}`}
            onClick={() => onChange({ ...value, hours: h })}
          >
            {h === 1 ? "1 hour" : `${h} hours`}
          </button>
        ))}
      </div>

      <div className="field-label with-meta" id="time-label">
        <span>Start time</span>
        {busy && <span className="meta">{freeCount ? `${freeCount} start times free` : "Fully booked"}</span>}
      </div>
      {loadError && <p className="alert warn">Couldn&apos;t load live availability; you can still pick a time and we&apos;ll check it.</p>}
      <div className="time-grid" role="radiogroup" aria-labelledby="time-label" aria-busy={!busy}>
        {!busy
          ? Array.from({ length: 12 }, (_, i) => <span key={i} className="time-slot skeleton" />)
          : times.map((t) => {
              const selected = t.time === value.time;
              return (
                <button
                  key={t.time}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={t.state !== "free"}
                  className={`time-slot is-${t.state}${selected ? " is-selected" : ""}`}
                  onClick={() => onChange({ ...value, time: t.time })}
                  title={t.state === "taken" ? "Already booked" : t.state === "past" ? "In the past" : undefined}
                >
                  {t.time}
                </button>
              );
            })}
      </div>
      <div className="legend" aria-hidden="true">
        <span>
          <i className="swatch free" /> Free
        </span>
        <span>
          <i className="swatch taken" /> Booked
        </span>
        <span>
          <i className="swatch selected" /> Your pick
        </span>
      </div>
    </div>
  );
}
