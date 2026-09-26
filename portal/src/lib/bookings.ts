import { ApiError } from "./errors";
import { dataverse, DataverseFailure, odataString } from "./dataverse";
import { CANCELLATION_REASONS } from "./shared";

// Booking status values
const STATUS = { Draft: 100000000, Confirmed: 100000001, Cancelled: 100000002, Completed: 100000003 } as const;

export const FORMATTED = "@OData.Community.Display.V1.FormattedValue";

export type DvRecord = Record<string, unknown>;
export type DvList = { value: DvRecord[] };

// Input validation
const REFERENCE = /^BK-\d{6}$/;
export const FACILITY_CODE = /^[A-Za-z0-9_-]{1,100}$/;
const EMAIL = /^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/;

export function parseReference(value: string): string {
  const reference = value.trim().toUpperCase();
  if (!REFERENCE.test(reference)) throw notFound();
  return reference;
}

export function requireEmail(value: unknown): string {
  if (typeof value !== "string" || !EMAIL.test(value.trim()) || value.length > 100)
    throw new ApiError(400, "A valid email address is required.");
  return value.trim().toLowerCase();
}

export function requireText(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim()) throw new ApiError(400, `${field} is required.`);
  if (value.trim().length > max) throw new ApiError(400, `${field} must be at most ${max} characters.`);
  return value.trim();
}

function requireDateTime(value: unknown, field: string): string {
  const date = typeof value === "string" ? new Date(value) : undefined;
  if (!date || isNaN(date.getTime()) || !/(Z|[+-]\d{2}:?\d{2})$/i.test(value as string))
    throw new ApiError(400, `${field} must be an ISO 8601 date-time with a time zone, e.g. 2026-10-01T10:00:00Z.`);
  return date.toISOString();
}

// Same answer for a wrong reference or email
function notFound(): ApiError {
  return new ApiError(404, "No booking matches that reference and email address.");
}

// Turn Dataverse errors into customer messages
const FIELD_LABELS: Record<string, string> = {
  ye_starttime: "start time",
  ye_endtime: "end time",
  ye_cancellationreason: "cancellation reason",
  ye_facility: "facility",
  ye_customer: "member",
};

function translate(err: unknown): never {
  if (!(err instanceof DataverseFailure)) throw err;
  const msg = err.message;
  if (/already booked|under maintenance/i.test(msg)) throw new ApiError(409, msg);
  if (/end time must be after/i.test(msg)) throw new ApiError(422, "The end time must be after the start time.");
  const missing = Object.keys(FIELD_LABELS).filter((f) => msg.includes(f));
  if (/ValidateRequiredField|required/i.test(msg) && missing.length)
    throw new ApiError(422, `Missing required ${missing.map((f) => FIELD_LABELS[f]).join(", ")}.`);
  if (err.status === 404 && /ye_facility/i.test(msg)) throw new ApiError(404, "Unknown facility code.");
  console.error(`Dataverse ${err.status}: ${msg}`);
  if (err.status === 401 || err.status === 403) throw new ApiError(502, "The booking service is temporarily unavailable.");
  throw new ApiError(502, "The booking could not be processed. Please try again.");
}

// Dataverse call with translated errors
export async function dv<T>(...args: Parameters<typeof dataverse>): Promise<T> {
  try {
    return await dataverse<T>(...args);
  } catch (err) {
    translate(err);
  }
}

// Booking fields returned to the client
const BOOKING_SELECT = "ye_bookingid,ye_bookingreference,ye_status,ye_starttime,ye_endtime,ye_totalprice,ye_cancellationreason,ye_paymentstatus";
const BOOKING_EXPAND =
  "ye_facility($select=ye_facilitycode,ye_name,ye_facilitytype),ye_customer_contact($select=emailaddress1),ye_customer_account($select=emailaddress1)," +
  "ye_maintenancecase($select=ye_expectedreturn)";

export type Booking = {
  reference: string;
  status: string;
  facility: { code: string; name: string; typeCode: number } | null;
  start: string | null;
  end: string | null;
  totalPrice: number | null;
  totalPriceFormatted: string | null;
  cancellationReason: string | null;
  paymentStatus: string | null;
  affectedByMaintenance: { expectedBackInService: string | null } | null;
};

// Map a Dataverse record to a booking
function toBooking(r: DvRecord): Booking {
  const facility = r.ye_facility as DvRecord | null | undefined;
  return {
    reference: r.ye_bookingreference as string,
    status: (r[`ye_status${FORMATTED}`] as string) ?? String(r.ye_status),
    facility: facility
      ? { code: facility.ye_facilitycode as string, name: facility.ye_name as string, typeCode: facility.ye_facilitytype as number }
      : null,
    start: (r.ye_starttime as string) ?? null,
    end: (r.ye_endtime as string) ?? null,
    totalPrice: (r.ye_totalprice as number) ?? null,
    totalPriceFormatted: (r[`ye_totalprice${FORMATTED}`] as string) ?? null,
    cancellationReason: (r[`ye_cancellationreason${FORMATTED}`] as string) ?? null,
    paymentStatus: (r[`ye_paymentstatus${FORMATTED}`] as string) ?? null,
    affectedByMaintenance: r.ye_maintenancecase
      ? { expectedBackInService: ((r.ye_maintenancecase as DvRecord).ye_expectedreturn as string) ?? null }
      : null,
  };
}

export type Facility = {
  code: string;
  name: string;
  type: string;
  typeCode: number;
  hourlyRate: number;
  hourlyRateFormatted: string;
  capacity: number;
  availability: string;
  bookable: boolean;
};

// List facilities, optionally only bookable ones
export async function listFacilities(onlyAvailable: boolean): Promise<Facility[]> {
  const filter = onlyAvailable ? "&$filter=ye_availabilitystatus eq 100000000" : "";
  const result = await dv<DvList>(
    "GET",
    `ye_facilities?$select=ye_facilitycode,ye_name,ye_facilitytype,ye_hourlyrate,ye_capacity,ye_availabilitystatus&$orderby=ye_name${filter}`,
  );
  return result.value.map((f) => ({
    code: f.ye_facilitycode as string,
    name: f.ye_name as string,
    type: f[`ye_facilitytype${FORMATTED}`] as string,
    typeCode: f.ye_facilitytype as number,
    hourlyRate: f.ye_hourlyrate as number,
    hourlyRateFormatted: f[`ye_hourlyrate${FORMATTED}`] as string,
    capacity: f.ye_capacity as number,
    availability: f[`ye_availabilitystatus${FORMATTED}`] as string,
    bookable: f.ye_availabilitystatus === 100000000,
  }));
}

export type BusySlot = { start: string; end: string };

const MAX_AVAILABILITY_DAYS = 8;

// Busy times for a facility, without booking details
export async function getBusySlots(facilityCode: string, fromValue: unknown, toValue: unknown): Promise<BusySlot[]> {
  if (!FACILITY_CODE.test(facilityCode)) throw new ApiError(404, "Unknown facility code.");
  const from = requireDateTime(fromValue, "from");
  const to = requireDateTime(toValue, "to");
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days <= 0 || days > MAX_AVAILABILITY_DAYS)
    throw new ApiError(400, `"to" must be after "from" and at most ${MAX_AVAILABILITY_DAYS} days later.`);

  const code = odataString(facilityCode);
  const [facility, busy] = await Promise.all([
    dv<DvList>("GET", `ye_facilities?$select=ye_facilityid&$filter=ye_facilitycode eq ${code}`),
    dv<DvList>(
      "GET",
      `ye_bookings?$select=ye_starttime,ye_endtime&$orderby=ye_starttime` +
        `&$filter=ye_facility/ye_facilitycode eq ${code} and ye_status ne ${STATUS.Cancelled}` +
        ` and ye_starttime lt ${to} and ye_endtime gt ${from}`,
    ),
  ]);
  if (facility.value.length === 0) throw new ApiError(404, "Unknown facility code.");
  return busy.value.map((b) => ({ start: b.ye_starttime as string, end: b.ye_endtime as string }));
}

// Find a booking by reference and check the email
export async function findOwnedBooking(reference: string, email: string): Promise<DvRecord> {
  const result = await dv<DvList>(
    "GET",
    `ye_bookings?$select=${BOOKING_SELECT}&$expand=${BOOKING_EXPAND}&$filter=ye_bookingreference eq ${odataString(reference)}`,
  );
  const booking = result.value[0];
  const member = (booking?.ye_customer_contact ?? booking?.ye_customer_account) as DvRecord | null | undefined;
  const memberEmail = (member?.emailaddress1 as string | undefined)?.toLowerCase();
  if (!booking || !memberEmail || memberEmail !== email) throw notFound();
  return booking;
}

// Booking for the manage page
export async function getBooking(reference: string, email: string): Promise<Booking> {
  return toBooking(await findOwnedBooking(reference, email));
}

// Find a contact by email
export async function findContact(email: string): Promise<string | undefined> {
  const existing = await dv<DvList>(
    "GET",
    `contacts?$select=contactid&$filter=emailaddress1 eq ${odataString(email)} and statecode eq 0&$orderby=createdon&$top=1`,
  );
  return existing.value[0]?.contactid as string | undefined;
}

// Create a confirmed booking; plugins validate and price it
export async function createBooking(input: Record<string, unknown>): Promise<Booking> {
  const email = requireEmail(input.email);
  const firstName = requireText(input.firstName, "firstName", 50);
  const lastName = requireText(input.lastName, "lastName", 50);
  const facilityCode = requireText(input.facilityCode, "facilityCode", 100);
  if (!FACILITY_CODE.test(facilityCode)) throw new ApiError(404, "Unknown facility code.");
  const start = requireDateTime(input.start, "start");
  const end = requireDateTime(input.end, "end");

  const contactId = await findContact(email);
  const member = contactId
    ? { "ye_customer_contact@odata.bind": `/contacts(${contactId})` }
    : { ye_customer_contact: { firstname: firstName, lastname: lastName, emailaddress1: email } };

  const created = await dv<DvRecord>(
    "POST",
    `ye_bookings?$select=ye_bookingid`,
    {
      "ye_facility@odata.bind": `/ye_facilities(ye_facilitycode=${odataString(facilityCode)})`,
      ...member,
      ye_starttime: start,
      ye_endtime: end,
      ye_status: STATUS.Confirmed,
    },
    { returnRepresentation: true },
  );
  const booking = await dv<DvRecord>(
    "GET",
    `ye_bookings(${created.ye_bookingid})?$select=${BOOKING_SELECT}&$expand=${BOOKING_EXPAND}`,
  );
  return toBooking(booking);
}

// Move a booking to a new time
export async function rescheduleBooking(reference: string, input: Record<string, unknown>): Promise<Booking> {
  const email = requireEmail(input.email);
  const start = requireDateTime(input.start, "start");
  const end = requireDateTime(input.end, "end");
  const booking = await findOwnedBooking(reference, email);
  if (booking.ye_status !== STATUS.Confirmed)
    throw new ApiError(409, `A ${String(booking[`ye_status${FORMATTED}`]).toLowerCase()} booking can't be rescheduled.`);

  await dv("PATCH", `ye_bookings(${booking.ye_bookingid})`, { ye_starttime: start, ye_endtime: end });
  return getBooking(reference, email);
}

// Cancel a booking with a reason
export async function cancelBooking(reference: string, input: Record<string, unknown>): Promise<Booking> {
  const email = requireEmail(input.email);
  const reasonLabel = input.reason === undefined ? "Member Request" : input.reason;
  const reason = CANCELLATION_REASONS[reasonLabel as keyof typeof CANCELLATION_REASONS];
  if (reason === undefined)
    throw new ApiError(400, `reason must be one of: ${Object.keys(CANCELLATION_REASONS).join(", ")}.`);

  const booking = await findOwnedBooking(reference, email);
  if (booking.ye_status === STATUS.Cancelled) throw new ApiError(409, "This booking is already cancelled.");
  if (booking.ye_status === STATUS.Completed) throw new ApiError(409, "A completed booking can't be cancelled.");

  await dv("PATCH", `ye_bookings(${booking.ye_bookingid})`, { ye_status: STATUS.Cancelled, ye_cancellationreason: reason });
  return getBooking(reference, email);
}
