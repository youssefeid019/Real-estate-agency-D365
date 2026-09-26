"use client";

import Link from "next/link";
import { useState } from "react";
import type { Facility } from "@/lib/bookings";
import type { CaseReport } from "@/lib/cycles";
import { api, errorMessage } from "@/lib/client";
import { CaseProgress } from "../components/case-progress";
import { CheckIcon } from "../components/icons";

// Facility problem report form
export function ReportForm({
  facilities,
  initialBooking,
  initialFacility,
}: {
  facilities: Facility[];
  initialBooking: string;
  initialFacility?: string;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    bookingReference: initialBooking,
    facilityCode: facilities.some((f) => f.code === initialFacility) ? initialFacility! : "",
    title: "",
    description: "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [report, setReport] = useState<CaseReport>();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const viaBooking = form.bookingReference.trim() !== "";

  // Send the report
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!viaBooking && !form.facilityCode) return setError("Choose the facility, or enter your booking reference.");
    setPending(true);
    setError(undefined);
    try {
      setReport(
        await api<CaseReport>("/api/cases", {
          method: "POST",
          json: {
            ...form,
            facilityCode: viaBooking ? undefined : form.facilityCode,
            bookingReference: form.bookingReference.trim() || undefined,
          },
        }),
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (report)
    return (
      <div className="confirmation">
        <div className="confirmation-head" role="status">
          <span className="success-badge">
            <CheckIcon size={26} />
          </span>
          <div>
            <h2>Thanks, it&apos;s reported</h2>
            <p className="muted">Keep your case number: with your email you can follow the fix at any time.</p>
          </div>
        </div>
        <CaseProgress report={report} />
        <div className="button-row center">
          <Link className="button" href={`/track?case=${report.caseNumber}`}>
            Track this report
          </Link>
          <Link className="button ghost" href="/">
            Back to facilities
          </Link>
        </div>
      </div>
    );

  return (
    <form className="lookup-card wide" onSubmit={submit}>
      <div className="form-grid">
        <label>
          First name
          <input required maxLength={50} autoComplete="given-name" value={form.firstName} onChange={set("firstName")} />
        </label>
        <label>
          Last name
          <input required maxLength={50} autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />
        </label>
        <label className="span-2">
          Email
          <input type="email" required maxLength={100} autoComplete="email" value={form.email} onChange={set("email")} />
        </label>
        <label>
          <span>
            Booking reference <span className="hint">(if it happened during a booking)</span>
          </span>
          <input
            className="mono"
            placeholder="BK-000123"
            spellCheck={false}
            maxLength={20}
            value={form.bookingReference}
            onChange={set("bookingReference")}
          />
        </label>
        <label>
          <span>
            Facility {viaBooking && <span className="hint">(taken from the booking)</span>}
          </span>
          <select value={viaBooking ? "" : form.facilityCode} onChange={set("facilityCode")} disabled={viaBooking} required={!viaBooking}>
            <option value="">{viaBooking ? "From your booking" : "Choose a facility…"}</option>
            {facilities.map((f) => (
              <option key={f.code} value={f.code}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="span-2">
          What&apos;s wrong?
          <input required maxLength={200} placeholder="e.g. Floodlight on the north side is out" value={form.title} onChange={set("title")} />
        </label>
        <label className="span-2">
          Details
          <textarea
            required
            maxLength={2000}
            rows={5}
            placeholder="Where exactly, since when, is anyone at risk…"
            value={form.description}
            onChange={set("description")}
          />
        </label>
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <button className="button lg block" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send report"}
      </button>
      <p className="hint">
        Already reported something? <Link href="/track">Track your report</Link>
      </p>
    </form>
  );
}
