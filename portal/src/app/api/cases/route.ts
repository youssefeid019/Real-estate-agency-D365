import { handle, json, readJson } from "@/lib/errors";
import { reportProblem } from "@/lib/cycles";

// Report a facility problem
export const POST = handle(async (request: Request) => {
  const report = await reportProblem(await readJson(request));
  return json(report, 201, { Location: `/api/cases/${report.caseNumber}` });
});
