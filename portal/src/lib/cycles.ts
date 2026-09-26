import { ApiError } from "./errors";
import { odataString } from "./dataverse";
import {
  FACILITY_CODE,
  FORMATTED,
  dv,
  findContact,
  findOwnedBooking,
  parseReference,
  requireDateTime,
  requireEmail,
  requireText,
  type DvList,
  type DvRecord,
} from "./bookings";
import { FREQUENCIES, type Frequency } from "./shared";

// Choice values and formats
const LEAD_SOURCE_WEB = 8;
const CASE_ORIGIN_WEB = 3;
const CASE_NUMBER = /^CAS-\d{5}-[A-Z0-9]{6}$/;
const PHONE = /^[+()\d\s-]{6,30}$/;

export const CASE_STAGES = ["Report", "Triage", "Repair", "Resolve"] as const;

// Input validation
function optionalText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || (typeof value === "string" && !value.trim())) return undefined;
  return requireText(value, field, max);
}

function requireWholeNumber(value: unknown, field: string, min: number, max: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max)
    throw new ApiError(400, `${field} must be a whole number from ${min} to ${max}.`);
  return n;
}

function requireDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)))
    throw new ApiError(400, `${field} must be a date like 2026-10-15.`);
  return value;
}

function requireSessionHours(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0.5 || n > 12 || (n * 2) % 1 !== 0)
    throw new ApiError(400, "sessionHours must be from 0.5 to 12 in half hours.");
  return n;
}

function requireFrequency(value: unknown): number {
  if (typeof value !== "string" || !(value in FREQUENCIES))
    throw new ApiError(400, `frequency must be one of: ${Object.keys(FREQUENCIES).join(", ")}.`);
  return FREQUENCIES[value as Frequency];
}

function requireFacilityCode(value: unknown): string {
  const code = requireText(value, "facilityCode", 100);
  if (!FACILITY_CODE.test(code)) throw new ApiError(404, "Unknown facility code.");
  return code;
}

export type EnquiryReceipt = { received: true; company: string; facilityCode: string };

// Create a group enquiry as a lead
export async function createEnquiry(input: Record<string, unknown>): Promise<EnquiryReceipt> {
  const email = requireEmail(input.email);
  const firstName = requireText(input.firstName, "firstName", 50);
  const lastName = requireText(input.lastName, "lastName", 50);
  const company = requireText(input.company, "company", 100);
  const phone = optionalText(input.phone, "phone", 30);
  if (phone && !PHONE.test(phone)) throw new ApiError(400, "phone doesn't look like a phone number.");
  const facilityCode = requireFacilityCode(input.facilityCode);
  const groupSize = requireWholeNumber(input.groupSize, "groupSize", 1, 10000);
  const sessions = requireWholeNumber(input.sessions, "sessions", 1, 1000);
  const preferredStart = requireDate(input.preferredStart, "preferredStart");
  const firstSession = requireDateTime(input.firstSession, "firstSession");
  const sessionHours = requireSessionHours(input.sessionHours);
  const frequency = requireFrequency(input.frequency);
  const message = optionalText(input.message, "message", 2000);

  const [contactId, existingAccountId] = await Promise.all([findContact(email), findAccount(company)]);
  const accountId =
    existingAccountId ??
    ((await dv<DvRecord>("POST", "accounts?$select=accountid", { name: company, emailaddress1: email, ...(phone ? { telephone1: phone } : {}) }, { returnRepresentation: true }))
      .accountid as string);

  await dv("POST", "leads", {
    subject: `Group booking enquiry: ${company}`,
    firstname: firstName,
    lastname: lastName,
    emailaddress1: email,
    companyname: company,
    ...(phone ? { telephone1: phone } : {}),
    description: message ?? null,
    leadsourcecode: LEAD_SOURCE_WEB,
    "ye_Facility@odata.bind": `/ye_facilities(ye_facilitycode=${odataString(facilityCode)})`,
    ye_groupsize: groupSize,
    ye_sessions: sessions,
    ye_preferredstart: preferredStart,
    ye_firstsession: firstSession,
    ye_sessionhours: sessionHours,
    ye_frequency: frequency,
    ...(contactId ? { "parentcontactid@odata.bind": `/contacts(${contactId})` } : {}),
    "parentaccountid@odata.bind": `/accounts(${accountId})`,
  });
  return { received: true, company, facilityCode };
}

// Find a company account by name
async function findAccount(name: string): Promise<string | undefined> {
  const result = await dv<DvList>(
    "GET",
    `accounts?$select=accountid&$filter=name eq ${odataString(name)} and statecode eq 0&$orderby=createdon&$top=1`,
  );
  return result.value[0]?.accountid as string | undefined;
}

export type CaseReport = {
  caseNumber: string;
  title: string;
  facility: { code: string; name: string; typeCode: number } | null;
  bookingReference: string | null;
  reportedOn: string;
  stage: string;
  status: string;
  facilityClosed: boolean;
  expectedBackInService: string | null;
};

// Case fields returned to the client
const CASE_SELECT = "incidentid,ticketnumber,title,statecode,statuscode,createdon,ye_takesoutofservice,ye_expectedreturn";
const CASE_EXPAND =
  "customerid_contact($select=emailaddress1),ye_facility($select=ye_facilitycode,ye_name,ye_facilitytype),ye_Booking($select=ye_bookingreference)";

// Map a case to its public progress
async function toCaseReport(c: DvRecord): Promise<CaseReport> {
  const facility = c.ye_facility as DvRecord | null;
  const booking = c.ye_Booking as DvRecord | null;
  let stage: string;
  if (c.statecode === 1) stage = "Resolved";
  else if (c.statecode === 2) stage = "Cancelled";
  else {
    const bpf = await dv<DvList>(
      "GET",
      `ye_facilitymaintenanceprocesses?$select=_activestageid_value&$filter=_bpf_incidentid_value eq ${c.incidentid}`,
    );
    stage = (bpf.value[0]?.[`_activestageid_value${FORMATTED}`] as string) ?? CASE_STAGES[0];
  }
  return {
    caseNumber: c.ticketnumber as string,
    title: c.title as string,
    facility: facility
      ? { code: facility.ye_facilitycode as string, name: facility.ye_name as string, typeCode: facility.ye_facilitytype as number }
      : null,
    bookingReference: (booking?.ye_bookingreference as string) ?? null,
    reportedOn: c.createdon as string,
    stage,
    status: (c[`statuscode${FORMATTED}`] as string) ?? String(c.statuscode),
    facilityClosed: c.statecode === 0 && c.ye_takesoutofservice === true,
    expectedBackInService: (c.ye_expectedreturn as string) ?? null,
  };
}

// Log a facility problem as a case
export async function reportProblem(input: Record<string, unknown>): Promise<CaseReport> {
  const email = requireEmail(input.email);
  const firstName = requireText(input.firstName, "firstName", 50);
  const lastName = requireText(input.lastName, "lastName", 50);
  const title = requireText(input.title, "title", 200);
  const description = requireText(input.description, "description", 2000);
  const bookingReferenceInput = optionalText(input.bookingReference, "bookingReference", 20);

  let bookingId: string | undefined;
  let facilityCode: string | undefined =
    input.facilityCode === undefined || input.facilityCode === "" ? undefined : requireFacilityCode(input.facilityCode);
  if (bookingReferenceInput) {
    const booking = await findOwnedBooking(parseReference(bookingReferenceInput), email);
    bookingId = booking.ye_bookingid as string;
    const bookedFacility = (booking.ye_facility as DvRecord | null)?.ye_facilitycode as string | undefined;
    if (facilityCode && bookedFacility && facilityCode !== bookedFacility)
      throw new ApiError(400, "That booking is for a different facility.");
    facilityCode ??= bookedFacility;
  }
  if (!facilityCode) throw new ApiError(400, "facilityCode (or a bookingReference) is required.");

  const contactId =
    (await findContact(email)) ??
    ((await dv<DvRecord>("POST", "contacts?$select=contactid", { firstname: firstName, lastname: lastName, emailaddress1: email }, { returnRepresentation: true }))
      .contactid as string);

  const created = await dv<DvRecord>(
    "POST",
    "incidents?$select=incidentid",
    {
      title,
      description,
      caseorigincode: CASE_ORIGIN_WEB,
      "customerid_contact@odata.bind": `/contacts(${contactId})`,
      "ye_facility@odata.bind": `/ye_facilities(ye_facilitycode=${odataString(facilityCode)})`,
      ...(bookingId ? { "ye_Booking@odata.bind": `/ye_bookings(${bookingId})` } : {}),
    },
    { returnRepresentation: true },
  );
  const c = await dv<DvRecord>("GET", `incidents(${created.incidentid})?$select=${CASE_SELECT}&$expand=${CASE_EXPAND}`);
  return toCaseReport(c);
}

// Validate a case number
export function parseCaseNumber(value: string): string {
  const n = value.trim().toUpperCase();
  if (!CASE_NUMBER.test(n)) throw noCase();
  return n;
}

// Same answer for a wrong case number or email
function noCase(): ApiError {
  return new ApiError(404, "No report matches that case number and email address.");
}

// Track a report by case number and email
export async function getProblemReport(caseNumber: string, email: string): Promise<CaseReport> {
  const result = await dv<DvList>(
    "GET",
    `incidents?$select=${CASE_SELECT}&$expand=${CASE_EXPAND}&$filter=ticketnumber eq ${odataString(caseNumber)}`,
  );
  const c = result.value[0];
  const reporter = ((c?.customerid_contact as DvRecord | null)?.emailaddress1 as string | undefined)?.toLowerCase();
  if (!c || !reporter || reporter !== email) throw noCase();
  return toCaseReport(c);
}
