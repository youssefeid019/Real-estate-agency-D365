import { handle, json, readJson } from "@/lib/errors";
import { getBooking, parseReference, requireEmail, rescheduleBooking } from "@/lib/bookings";

type Context = { params: Promise<{ reference: string }> };

// Get a booking by reference and email
export const GET = handle(async (request: Request, { params }: Context) => {
  const reference = parseReference((await params).reference);
  const email = requireEmail(request.headers.get("x-customer-email"));
  return json(await getBooking(reference, email));
});

// Reschedule a booking
export const PATCH = handle(async (request: Request, { params }: Context) => {
  const reference = parseReference((await params).reference);
  return json(await rescheduleBooking(reference, await readJson(request)));
});
