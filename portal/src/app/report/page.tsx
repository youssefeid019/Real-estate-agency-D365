import type { Metadata } from "next";
import { listFacilities, type Facility } from "@/lib/bookings";
import { ReportForm } from "./report-form";

export const metadata: Metadata = { title: "Report a problem" };
export const dynamic = "force-dynamic";

// Report a problem page
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string | string[]; facility?: string | string[] }>;
}) {
  const { booking, facility } = await searchParams;
  let facilities: Facility[] = [];
  try {
    facilities = await listFacilities(false);
  } catch {}
  return (
    <>
      <div className="page-head center">
        <h1>Report a problem</h1>
        <p className="lead">Something broken, unsafe or not right at one of our facilities? Tell us and follow the fix.</p>
      </div>
      {facilities.length === 0 ? (
        <p className="alert error">We couldn&apos;t load the facilities right now. Please try again shortly.</p>
      ) : (
        <ReportForm
          facilities={facilities}
          initialBooking={typeof booking === "string" ? booking : ""}
          initialFacility={typeof facility === "string" ? facility : undefined}
        />
      )}
    </>
  );
}
