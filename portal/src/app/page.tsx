import Link from "next/link";
import { listFacilities, type Facility } from "@/lib/bookings";
import { FacilityExplorer } from "./components/facility-explorer";
import { ArrowRightIcon, BoltIcon, CalendarIcon, ShieldIcon, TicketIcon } from "./components/icons";

export const dynamic = "force-dynamic";

// Home page: facilities and how booking works
export default async function Home() {
  let facilities: Facility[] = [];
  let failed = false;
  try {
    facilities = await listFacilities(false);
  } catch {
    failed = true;
  }
  const open = facilities.filter((f) => f.bookable).length;
  const types = new Set(facilities.map((f) => f.typeCode)).size;
  const cheapest = facilities.filter((f) => f.bookable).sort((a, b) => a.hourlyRate - b.hourlyRate)[0];

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow-pill">
            <BoltIcon size={14} /> Instant confirmation
          </span>
          <h1>
            Your game. Your time.
            <br />
            <span className="gradient-text">Booked in seconds.</span>
          </h1>
          <p className="lead">
            Pitches, padel and basketball courts, squash and pools. See live availability, pick a free slot and get your
            booking reference straight away.
          </p>
          <div className="button-row">
            <Link className="button lg" href="/book">
              Book a slot <ArrowRightIcon />
            </Link>
            <Link className="button lg ghost" href="/manage">
              Manage a booking
            </Link>
          </div>
        </div>
        <dl className="hero-stats">
          <div>
            <dt>Open now</dt>
            <dd>
              {open}
              <small>/{facilities.length}</small>
            </dd>
          </div>
          <div>
            <dt>Sports</dt>
            <dd>{types}</dd>
          </div>
          <div>
            <dt>From</dt>
            <dd className="small">{cheapest ? cheapest.hourlyRateFormatted : "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="section" aria-labelledby="facilities-heading">
        <div className="section-head">
          <h2 id="facilities-heading">Facilities</h2>
          <p className="muted">Rates are per hour. Members with an active membership get their discount automatically.</p>
        </div>
        {failed ? (
          <p className="alert error">We couldn&apos;t load the facilities right now. Please try again shortly.</p>
        ) : facilities.length === 0 ? (
          <p className="alert">No facilities are listed yet.</p>
        ) : (
          <FacilityExplorer facilities={facilities} />
        )}
      </section>

      <section className="section steps" aria-labelledby="how-heading">
        <h2 id="how-heading">How it works</h2>
        <ol className="step-cards">
          <li>
            <span className="step-icon">
              <CalendarIcon />
            </span>
            <h3>Pick a free slot</h3>
            <p>Choose a facility and see which times are free for any of the next two weeks.</p>
          </li>
          <li>
            <span className="step-icon">
              <TicketIcon />
            </span>
            <h3>Get your reference</h3>
            <p>Your booking is confirmed on the spot, with a reference and the final price.</p>
          </li>
          <li>
            <span className="step-icon">
              <ShieldIcon />
            </span>
            <h3>Change plans safely</h3>
            <p>Reschedule or cancel anytime with your reference and email. No account needed.</p>
          </li>
        </ol>
      </section>
    </>
  );
}
