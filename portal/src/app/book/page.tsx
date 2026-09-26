import type { Metadata } from "next";
import Link from "next/link";
import { listFacilities, type Facility } from "@/lib/bookings";
import { BookingFlow } from "./booking-flow";

export const metadata: Metadata = { title: "Book" };
export const dynamic = "force-dynamic";

// Booking page
export default async function BookPage({ searchParams }: { searchParams: Promise<{ facility?: string | string[] }> }) {
  const { facility } = await searchParams;
  let facilities: Facility[] = [];
  let failed = false;
  try {
    facilities = await listFacilities(true);
  } catch {
    failed = true;
  }

  return (
    <>
      <div className="page-head">
        <Link href="/" className="back-link">
          ← All facilities
        </Link>
        <h1>Book a slot</h1>
        <p className="lead">Choose a facility, pick a free time, and you&apos;re done.</p>
      </div>
      {failed ? (
        <p className="alert error">We couldn&apos;t load the facilities right now. Please try again shortly.</p>
      ) : facilities.length === 0 ? (
        <p className="alert">No facilities are available to book right now.</p>
      ) : (
        <BookingFlow facilities={facilities} initialFacility={typeof facility === "string" ? facility : undefined} />
      )}
    </>
  );
}
