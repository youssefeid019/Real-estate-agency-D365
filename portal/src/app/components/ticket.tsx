"use client";

import { useState } from "react";
import type { Booking } from "@/lib/client";
import { FacilityArt } from "./facility-art";
import { CalendarIcon, CheckIcon, ClockIcon, CopyIcon } from "./icons";

// Booking ticket
export function Ticket({ booking, children }: { booking: Booking; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const start = booking.start ? new Date(booking.start) : undefined;
  const end = booking.end ? new Date(booking.end) : undefined;
  const t = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const hours = start && end ? (end.getTime() - start.getTime()) / 3_600_000 : undefined;
  const statusClass = booking.status === "Confirmed" ? "ok" : booking.status === "Cancelled" ? "danger" : "muted";

  // Copy the reference
  async function copy() {
    try {
      await navigator.clipboard.writeText(booking.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <article className={`ticket${booking.status === "Cancelled" ? " is-cancelled" : ""}`}>
      <div className="ticket-art">
        <FacilityArt typeCode={booking.facility?.typeCode ?? 0} muted={booking.status === "Cancelled"} />
        <span className={`pill ${statusClass}`}>{booking.status}</span>
      </div>
      <div className="ticket-body">
        <div className="ticket-head">
          <div>
            <div className="eyebrow">Booking reference</div>
            <div className="reference">{booking.reference}</div>
          </div>
          <button type="button" className="icon-button" onClick={copy} aria-label="Copy booking reference">
            {copied ? <CheckIcon /> : <CopyIcon />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
        <h2 className="ticket-title">{booking.facility?.name ?? "Facility"}</h2>
        <ul className="ticket-facts">
          <li>
            <CalendarIcon />
            {start ? start.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Not scheduled yet"}
          </li>
          {start && end && (
            <li>
              <ClockIcon />
              {t(start)} – {t(end)}
              {hours ? <span className="muted"> · {hours === 1 ? "1 hour" : `${hours} hours`}</span> : null}
            </li>
          )}
        </ul>
        <div className="ticket-divider" aria-hidden="true" />
        <div className="ticket-foot">
          <div>
            <div className="eyebrow">{booking.status === "Cancelled" ? "Was" : "Total"}</div>
            <div className="ticket-price">{booking.totalPriceFormatted ?? "—"}</div>
          </div>
          {booking.cancellationReason && (
            <div>
              <div className="eyebrow">Cancellation reason</div>
              <div className="strong">{booking.cancellationReason}</div>
            </div>
          )}
          {booking.paymentStatus && booking.status !== "Cancelled" && (
            <div>
              <div className="eyebrow">Payment</div>
              <div className="strong">{booking.paymentStatus === "Awaiting Payment" ? "Pay at reception" : booking.paymentStatus}</div>
            </div>
          )}
          {booking.paymentStatus === "Refund Due" && (
            <div>
              <div className="eyebrow">Payment</div>
              <div className="strong">Refund due</div>
            </div>
          )}
        </div>
        {booking.affectedByMaintenance && booking.status !== "Cancelled" && booking.status !== "Completed" && (
          <p className="alert warn compact">
            The facility is closed for maintenance
            {booking.affectedByMaintenance.expectedBackInService
              ? ` until about ${new Date(booking.affectedByMaintenance.expectedBackInService).toLocaleDateString(undefined, { day: "numeric", month: "long" })}`
              : ""}
            . We&apos;ll contact you to move this booking, or you can reschedule or cancel it here.
          </p>
        )}
        {children}
      </div>
    </article>
  );
}
