"use client";

import Link from "next/link";
import { useState } from "react";
import { api, errorMessage, type Booking } from "@/lib/client";
import { CANCELLATION_REASONS, type CancellationReason } from "@/lib/shared";
import { SearchIcon } from "../components/icons";
import { SlotPicker, describeSlot, slotFrom, toRange, type Slot } from "../components/slot-picker";
import { Ticket } from "../components/ticket";

type Mode = "view" | "reschedule" | "cancel";

// Find, reschedule or cancel a booking
export function ManageBooking({ initialReference }: { initialReference: string }) {
  const [reference, setReference] = useState(initialReference);
  const [email, setEmail] = useState("");
  const [booking, setBooking] = useState<Booking>();
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [mode, setMode] = useState<Mode>("view");
  const [slot, setSlot] = useState<Slot>({ day: "", time: null, hours: 1 });
  const [reason, setReason] = useState<CancellationReason>("Member Request");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  // Run an action with loading and error state
  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  // Look up the booking
  const find = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const found = await api<Booking>(`/api/bookings/${encodeURIComponent(reference.trim().toUpperCase())}`, {
        headers: { "X-Customer-Email": email.trim() },
      });
      setBooking(found);
      setVerifiedEmail(email.trim());
      setMode("view");
    });
  };

  // Move it to the new slot
  const reschedule = (e: React.FormEvent) => {
    e.preventDefault();
    const range = toRange(slot);
    if (!range) return setError("Pick a new start time first.");
    return run(async () => {
      setBooking(await api<Booking>(`/api/bookings/${booking!.reference}`, { method: "PATCH", json: { email: verifiedEmail, ...range } }));
      setMode("view");
      setNotice("Booking moved. The price has been updated for the new time.");
    });
  };

  // Cancel with the chosen reason
  const cancel = (e: React.FormEvent) => {
    e.preventDefault();
    return run(async () => {
      setBooking(
        await api<Booking>(`/api/bookings/${booking!.reference}/cancel`, { method: "POST", json: { email: verifiedEmail, reason } }),
      );
      setMode("view");
      setNotice("Your booking has been cancelled.");
    });
  };

  const errorBox = error && (
    <p className="alert error" role="alert">
      {error}
    </p>
  );

  if (!booking) {
    return (
      <form className="lookup-card" onSubmit={find}>
        <span className="lookup-icon">
          <SearchIcon size={22} />
        </span>
        <h2>Find your booking</h2>
        <p className="muted">Use the reference from your confirmation and the email you booked with.</p>
        <div className="form-grid">
          <label>
            Booking reference
            <input
              required
              placeholder="BK-000123"
              autoCapitalize="characters"
              spellCheck={false}
              className="mono"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label>
            Email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>
        {errorBox}
        <button className="button lg block" type="submit" disabled={pending}>
          {pending ? "Looking up…" : "Find my booking"}
        </button>
      </form>
    );
  }

  const changeable = booking.status === "Confirmed";
  const current = booking.start && booking.end ? { start: booking.start, end: booking.end } : undefined;

  return (
    <div className="manage-layout">
      <Ticket booking={booking}>
        {notice && (
          <p className="alert success compact" role="status">
            {notice}
          </p>
        )}
        {mode === "view" && (
          <>
            {errorBox}
            <div className="button-row">
              {changeable && (
                <>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setSlot(slotFrom(booking.start, booking.end) ?? { day: "", time: null, hours: 1 });
                      setMode("reschedule");
                      setNotice(undefined);
                    }}
                  >
                    Reschedule
                  </button>
                  <button type="button" className="button ghost danger-text" onClick={() => (setMode("cancel"), setNotice(undefined))}>
                    Cancel booking
                  </button>
                </>
              )}
              <button
                type="button"
                className="button ghost"
                onClick={() => {
                  setBooking(undefined);
                  setNotice(undefined);
                  setError(undefined);
                }}
              >
                Find another
              </button>
            </div>
            {!changeable && <p className="hint">This booking can no longer be changed.</p>}
            <p className="hint">
              Something wrong at the facility? <Link href={`/report?booking=${booking.reference}`}>Report a problem with this booking</Link>
            </p>
          </>
        )}
      </Ticket>

      {mode === "reschedule" && booking.facility && (
        <form className="step-panel" onSubmit={reschedule}>
          <h2>Pick a new time</h2>
          <SlotPicker facilityCode={booking.facility.code} value={slot} onChange={setSlot} ignore={current} />
          <div className="reschedule-foot">
            <div className="muted small">{describeSlot(slot) ?? "Choose a start time"}</div>
            {errorBox}
            <div className="button-row">
              <button className="button" type="submit" disabled={pending || !slot.time}>
                {pending ? "Saving…" : "Move my booking"}
              </button>
              <button type="button" className="button ghost" onClick={() => (setMode("view"), setError(undefined))}>
                Back
              </button>
            </div>
          </div>
        </form>
      )}

      {mode === "cancel" && (
        <form className="step-panel danger-panel" onSubmit={cancel}>
          <h2>Cancel this booking?</h2>
          <p className="muted">The slot is released straight away so others can book it.</p>
          <div className="field-label">Reason</div>
          <div className="chips" role="radiogroup" aria-label="Cancellation reason">
            {(Object.keys(CANCELLATION_REASONS) as CancellationReason[]).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                className={`chip${reason === r ? " is-selected" : ""}`}
                onClick={() => setReason(r)}
              >
                {r}
              </button>
            ))}
          </div>
          {errorBox}
          <div className="button-row">
            <button className="button danger" type="submit" disabled={pending}>
              {pending ? "Cancelling…" : "Yes, cancel it"}
            </button>
            <button type="button" className="button ghost" onClick={() => (setMode("view"), setError(undefined))}>
              Keep my booking
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
