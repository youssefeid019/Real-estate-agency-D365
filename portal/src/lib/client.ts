import type { Booking } from "./bookings";

export type { Booking };

// Call the portal API from the browser
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const resp = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(data?.error ?? "Something went wrong. Please try again.");
  return data as T;
}

// Format a booking's date and time range
export function formatRange(start: string | null, end: string | null): string {
  if (!start || !end) return "Not scheduled yet";
  const s = new Date(start);
  const e = new Date(end);
  const day = s.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${time(s)} – ${time(e)}`;
}

// Readable message from an error
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

// Format an amount like a sample currency string
export function formatLike(sample: string, amount: number): string {
  return sample.replace(/\d[\d.,\s ]*\d|\d/, amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
}
