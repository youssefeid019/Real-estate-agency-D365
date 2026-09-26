import type { Metadata } from "next";
import { ManageBooking } from "./manage-booking";

export const metadata: Metadata = { title: "My booking" };

// Manage booking page
export default async function ManagePage({ searchParams }: { searchParams: Promise<{ reference?: string | string[] }> }) {
  const { reference } = await searchParams;
  return (
    <>
      <div className="page-head center">
        <h1>My booking</h1>
        <p className="lead">See your booking, move it to another time, or cancel it.</p>
      </div>
      <ManageBooking initialReference={typeof reference === "string" ? reference : ""} />
    </>
  );
}
