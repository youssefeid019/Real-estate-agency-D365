import type { Metadata } from "next";
import Link from "next/link";
import { listFacilities, type Facility } from "@/lib/bookings";
import { EnquiryForm } from "./enquiry-form";
import { CalendarIcon, TicketIcon, UsersIcon } from "../components/icons";

export const metadata: Metadata = { title: "Group & corporate bookings" };
export const dynamic = "force-dynamic";

// Group and corporate enquiries page
export default async function GroupsPage() {
  let facilities: Facility[] = [];
  try {
    facilities = await listFacilities(false);
  } catch {}

  return (
    <>
      <div className="page-head">
        <span className="eyebrow-pill">
          <UsersIcon size={14} /> Teams, clubs, schools &amp; companies
        </span>
        <h1>Group &amp; corporate bookings</h1>
        <p className="lead">
          Booking a block of sessions for a team, a league or your company? Tell us what you need and our sales team will
          put together a proposal, then reserve your sessions once you&apos;re happy.
        </p>
      </div>
      <div className="split-layout">
        <section className="step-panel" aria-labelledby="enquiry-heading">
          <h2 id="enquiry-heading">Your enquiry</h2>
          {facilities.length === 0 ? (
            <p className="alert error">We couldn&apos;t load the facilities right now. Please try again shortly.</p>
          ) : (
            <EnquiryForm facilities={facilities} />
          )}
        </section>
        <aside className="info-card" aria-label="What happens next">
          <h3>What happens next</h3>
          <ol className="timeline">
            <li>
              <span className="timeline-dot">1</span>
              <div>
                <strong>We qualify your enquiry</strong>
                <p className="muted small">A member of our sales team reviews it and gets in touch, usually within one working day.</p>
              </div>
            </li>
            <li>
              <span className="timeline-dot">2</span>
              <div>
                <strong>You get a proposal</strong>
                <p className="muted small">Sessions, schedule and price for your group, with any member discounts.</p>
              </div>
            </li>
            <li>
              <span className="timeline-dot">3</span>
              <div>
                <strong>We reserve your sessions</strong>
                <p className="muted small">Once you accept, our coordinators schedule the bookings and confirm them.</p>
              </div>
            </li>
          </ol>
          <div className="info-foot muted small">
            <CalendarIcon size={15} /> Just need a single slot? <Link href="/book">Book it now</Link>
            <br />
            <TicketIcon size={15} /> Already booked? <Link href="/manage">Manage your booking</Link>
          </div>
        </aside>
      </div>
    </>
  );
}
