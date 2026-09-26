"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Facility } from "@/lib/bookings";
import { api, errorMessage } from "@/lib/client";
import { CLOSING_HOUR, FREQUENCIES, OPENING_HOUR, SLOT_MINUTES } from "@/lib/shared";
import { CheckIcon } from "../components/icons";
import { DURATIONS } from "../components/slot-picker";

// Start times within opening hours
const START_TIMES = Array.from({ length: ((CLOSING_HOUR - OPENING_HOUR) * 60) / SLOT_MINUTES }, (_, i) => {
  const minutes = OPENING_HOUR * 60 + i * SLOT_MINUTES;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

// Group booking enquiry form
export function EnquiryForm({ facilities }: { facilities: Facility[] }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    facilityCode: facilities[0].code,
    groupSize: "10",
    sessions: "6",
    preferredStart: "",
    startTime: "18:00",
    sessionHours: "1.5",
    frequency: "Weekly",
    message: "",
  });
  const [minDate, setMinDate] = useState<string>();
  useEffect(() => setMinDate(new Date().toISOString().slice(0, 10)), []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<{ company: string }>();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Send the enquiry
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      await api("/api/enquiries", {
        method: "POST",
        json: {
          ...form,
          groupSize: Number(form.groupSize),
          sessions: Number(form.sessions),
          sessionHours: Number(form.sessionHours),
          firstSession: new Date(`${form.preferredStart}T${form.startTime}`).toISOString(),
        },
      });
      setSent({ company: form.company });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (sent)
    return (
      <div className="confirmation-inline" role="status">
        <span className="success-badge">
          <CheckIcon size={24} />
        </span>
        <div>
          <h3>Thanks, we&apos;ve got your enquiry</h3>
          <p className="muted">
            Our sales team will contact you about {sent.company}&apos;s sessions, usually within one working day.
          </p>
          <div className="button-row">
            <Link className="button ghost" href="/">
              Back to facilities
            </Link>
          </div>
        </div>
      </div>
    );

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        First name
        <input required maxLength={50} autoComplete="given-name" value={form.firstName} onChange={set("firstName")} />
      </label>
      <label>
        Last name
        <input required maxLength={50} autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />
      </label>
      <label>
        Email
        <input type="email" required maxLength={100} autoComplete="email" value={form.email} onChange={set("email")} />
      </label>
      <label>
        <span>
          Phone <span className="hint">(optional)</span>
        </span>
        <input type="tel" maxLength={30} autoComplete="tel" value={form.phone} onChange={set("phone")} />
      </label>
      <label className="span-2">
        Team, club or company
        <input required maxLength={100} autoComplete="organization" value={form.company} onChange={set("company")} />
      </label>
      <label className="span-2">
        Facility
        <select value={form.facilityCode} onChange={set("facilityCode")}>
          {facilities.map((f) => (
            <option key={f.code} value={f.code}>
              {f.name} ({f.type}, up to {f.capacity})
            </option>
          ))}
        </select>
      </label>
      <label>
        Group size
        <input type="number" required min={1} max={10000} value={form.groupSize} onChange={set("groupSize")} />
      </label>
      <label>
        Sessions
        <input type="number" required min={1} max={1000} value={form.sessions} onChange={set("sessions")} />
      </label>
      <label>
        First session date
        <input type="date" required min={minDate} value={form.preferredStart} onChange={set("preferredStart")} />
      </label>
      <label>
        Start time
        <select value={form.startTime} onChange={set("startTime")}>
          {START_TIMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label>
        Hours per session
        <select value={form.sessionHours} onChange={set("sessionHours")}>
          {DURATIONS.map((h) => (
            <option key={h} value={String(h)}>
              {h} h
            </option>
          ))}
        </select>
      </label>
      <label>
        How often
        <select value={form.frequency} onChange={set("frequency")}>
          {Object.keys(FREQUENCIES).map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <label className="span-2">
        <span>
          Anything else? <span className="hint">(optional)</span>
        </span>
        <textarea maxLength={2000} rows={4} placeholder="Equipment, access or anything we should know…" value={form.message} onChange={set("message")} />
      </label>
      {error && (
        <p className="alert error span-2" role="alert">
          {error}
        </p>
      )}
      <div className="span-2">
        <button className="button lg" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send enquiry"}
        </button>
      </div>
    </form>
  );
}
