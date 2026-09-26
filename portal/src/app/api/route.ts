import { json } from "@/lib/errors";

// API index
export function GET() {
  return json({
    name: "YE Sports Facility booking API",
    endpoints: {
      "GET /api/facilities[?available=true]": "List facilities with rate, capacity and availability",
      "POST /api/bookings": "Book: { email, firstName, lastName, facilityCode, start, end }",
      "GET /api/bookings/{reference}": "Find a booking; header X-Customer-Email",
      "PATCH /api/bookings/{reference}": "Reschedule: { email, start, end }",
      "POST /api/bookings/{reference}/cancel": "Cancel: { email, reason? }",
      "GET /api/facilities/{code}/availability?from=&to=": "Busy time ranges (max 8 days)",
      "POST /api/enquiries": "Group/corporate enquiry -> Lead: { firstName, lastName, email, phone?, company, facilityCode, groupSize, sessions, preferredStart, message? }",
      "POST /api/cases": "Report a problem -> Case: { firstName, lastName, email, title, description, facilityCode?, bookingReference? }",
      "GET /api/cases/{caseNumber}": "Track a report; header X-Customer-Email",
    },
  });
}
