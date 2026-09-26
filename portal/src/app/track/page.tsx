import type { Metadata } from "next";
import { TrackReport } from "./track-report";

export const metadata: Metadata = { title: "Track a report" };

// Track a report page
export default async function TrackPage({ searchParams }: { searchParams: Promise<{ case?: string | string[] }> }) {
  const { case: caseNumber } = await searchParams;
  return (
    <>
      <div className="page-head center">
        <h1>Track a report</h1>
        <p className="lead">See where your problem report is in our maintenance process.</p>
      </div>
      <TrackReport initialCase={typeof caseNumber === "string" ? caseNumber : ""} />
    </>
  );
}
