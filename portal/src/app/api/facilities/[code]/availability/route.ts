import { handle, json } from "@/lib/errors";
import { getBusySlots } from "@/lib/bookings";

type Context = { params: Promise<{ code: string }> };

// Busy slots for a facility
export const GET = handle(async (request: Request, { params }: Context) => {
  const { code } = await params;
  const query = new URL(request.url).searchParams;
  return json({ busy: await getBusySlots(code, query.get("from") ?? undefined, query.get("to") ?? undefined) });
});
