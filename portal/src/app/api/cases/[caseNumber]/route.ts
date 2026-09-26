import { handle, json } from "@/lib/errors";
import { requireEmail } from "@/lib/bookings";
import { getProblemReport, parseCaseNumber } from "@/lib/cycles";

type Context = { params: Promise<{ caseNumber: string }> };

// Track a problem report
export const GET = handle(async (request: Request, { params }: Context) => {
  const caseNumber = parseCaseNumber((await params).caseNumber);
  return json(await getProblemReport(caseNumber, requireEmail(request.headers.get("x-customer-email"))));
});
