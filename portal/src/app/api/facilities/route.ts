import { handle, json } from "@/lib/errors";
import { listFacilities } from "@/lib/bookings";

// List facilities
export const GET = handle(async (request: Request) => {
  const onlyAvailable = new URL(request.url).searchParams.get("available") === "true";
  return json({ facilities: await listFacilities(onlyAvailable) });
});
