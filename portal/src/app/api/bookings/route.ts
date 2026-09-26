import { handle, json, readJson } from "@/lib/errors";
import { createBooking } from "@/lib/bookings";

// Create a booking
export const POST = handle(async (request: Request) => {
  const booking = await createBooking(await readJson(request));
  return json(booking, 201, { Location: `/api/bookings/${booking.reference}` });
});
