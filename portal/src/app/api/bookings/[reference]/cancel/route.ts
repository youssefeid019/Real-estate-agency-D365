import { handle, json, readJson } from "@/lib/errors";
import { cancelBooking, parseReference } from "@/lib/bookings";

type Context = { params: Promise<{ reference: string }> };

// Cancel a booking
export const POST = handle(async (request: Request, { params }: Context) => {
  const reference = parseReference((await params).reference);
  return json(await cancelBooking(reference, await readJson(request)));
});
