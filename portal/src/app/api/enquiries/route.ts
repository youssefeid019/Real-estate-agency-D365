import { handle, json, readJson } from "@/lib/errors";
import { createEnquiry } from "@/lib/cycles";

// Submit a group enquiry
export const POST = handle(async (request: Request) => json(await createEnquiry(await readJson(request)), 201));
