"use client";

import Link from "next/link";
import { useState } from "react";
import type { Facility } from "@/lib/bookings";
import { api, errorMessage, formatLike, type Booking } from "@/lib/client";
import { FacilityArt } from "../components/facility-art";
import { ArrowRightIcon, CheckIcon, UsersIcon } from "../components/icons";
import { SlotPicker, describeSlot, toRange, type Slot } from "../components/slot-picker";
import { Ticket } from "../components/ticket";

// Pick a facility and slot, then book
export function BookingFlow({ facilities, initialFacility }: { facilities: Facility[]; initialFacility?: string }) {
  const [facilityCode, setFacilityCode] = useState(
    facilities.some((f) => f.code === initialFacility) ? initialFacility! : facilities[0].code,
  );
  const [slot, setSlot] = useState<Slot>({ day: "", time: null, hours: 1 });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [booking, setBooking] = useState<Booking>();

  const facility = facilities.find((f) => f.code === facilityCode)!;
  const estimate = slot.hours * facility.hourlyRate;
  const when = describeSlot(slot);

  // Switch facility and clear the slot
  function chooseFacility(code: string) {
    setFacilityCode(code);
    setSlot((s) => ({ ...s, time: null }));
    setError(undefined);
  }

  // Create the booking
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const range = toRange(slot);
    if (!range) return setError("Pick a start time first.");
    setPending(true);
    setError(undefined);
    try {
      setBooking(await api<Booking>("/api/bookings", { method: "POST", json: { facilityCode, ...range, firstName, lastName, email } }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (booking) {
    const discounted = booking.totalPrice !== null && booking.totalPrice < estimate;
    return (
      <div className="confirmation">
        <div className="confirmation-head" role="status">
          <span className="success-badge">
            <CheckIcon size={26} />
          </span>
          <div>
            <h2>You&apos;re booked!</h2>
            <p className="muted">Keep your reference: with your email it&apos;s all you need to change or cancel.</p>
          </div>
        </div>
        <Ticket booking={booking}>
          {discounted && <p className="alert success compact">Member discount applied to your price.</p>}
        </Ticket>
        <div className="button-row center">
          <Link className="button" href={`/manage?reference=${booking.reference}`}>
            Manage this booking
          </Link>
          <button
            type="button"
            className="button ghost"
            onClick={() => {
              setBooking(undefined);
              setSlot((s) => ({ ...s, time: null }));
            }}
          >
            Book another slot
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="book-layout" onSubmit={submit}>
      <div className="book-steps">
        <section className="step-panel" aria-labelledby="step-facility">
          <h2 id="step-facility">
            <span className="step-no">1</span> Facility
          </h2>
          <div className="facility-picker" role="radiogroup" aria-labelledby="step-facility">
            {facilities.map((f) => (
              <button
                key={f.code}
                type="button"
                role="radio"
                aria-checked={f.code === facilityCode}
                className={`facility-option${f.code === facilityCode ? " is-selected" : ""}`}
                onClick={() => chooseFacility(f.code)}
              >
                <FacilityArt typeCode={f.typeCode} className="thumb" />
                <span className="facility-option-text">
                  <strong>{f.name}</strong>
                  <span className="muted small">
                    {f.type} · <bdi>{f.hourlyRateFormatted}</bdi>/h
                  </span>
                </span>
                <span className="radio-dot" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>

        <section className="step-panel" aria-labelledby="step-when">
          <h2 id="step-when">
            <span className="step-no">2</span> When
          </h2>
          <SlotPicker key={facilityCode} facilityCode={facilityCode} value={slot} onChange={setSlot} />
        </section>

        <section className="step-panel" aria-labelledby="step-details">
          <h2 id="step-details">
            <span className="step-no">3</span> Your details
          </h2>
          <div className="form-grid">
            <label>
              First name
              <input required maxLength={50} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label>
              Last name
              <input required maxLength={50} autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
            <label className="span-2">
              Email
              <input type="email" required maxLength={100} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <span className="hint">We use it with your booking reference to find your booking. No account needed.</span>
            </label>
          </div>
        </section>
      </div>

      <aside className="summary" aria-label="Booking summary">
        <div className="summary-card">
          <div className="summary-art">
            <FacilityArt typeCode={facility.typeCode} />
          </div>
          <div className="summary-body">
            <div className="eyebrow">{facility.type}</div>
            <h3>{facility.name}</h3>
            <div className="muted small summary-meta">
              <UsersIcon size={14} /> Up to {facility.capacity}
            </div>
            <dl className="summary-lines">
              <div>
                <dt>When</dt>
                <dd>{when ?? <span className="muted">Pick a start time</span>}</dd>
              </div>
              <div>
                <dt>Rate</dt>
                <dd>
                  {slot.hours} h × <bdi>{facility.hourlyRateFormatted}</bdi>
                </dd>
              </div>
            </dl>
            <div className="summary-total">
              <span>Estimated total</span>
              <strong>
                <bdi>{formatLike(facility.hourlyRateFormatted, estimate)}</bdi>
              </strong>
            </div>
            <p className="hint">Active members get their discount on the confirmed price.</p>
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            <button className="button lg block" type="submit" disabled={pending || !slot.time}>
              {pending ? "Confirming…" : (
                <>
                  Confirm booking <ArrowRightIcon />
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </form>
  );
}
