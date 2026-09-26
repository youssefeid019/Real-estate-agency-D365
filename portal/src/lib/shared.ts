// Choice values shared by server and client
export const CANCELLATION_REASONS = {
  "Member Request": 100000000,
  "Facility Unavailable": 100000001,
  Weather: 100000002,
  Other: 100000003,
} as const;

export type CancellationReason = keyof typeof CANCELLATION_REASONS;

// How often block booking sessions repeat
export const FREQUENCIES = { Weekly: 100000000, "Every two weeks": 100000001, Daily: 100000002 } as const;

export type Frequency = keyof typeof FREQUENCIES;

export const FACILITY_TYPES = { Pitch: 100000000, IndoorCourt: 100000001, SwimmingPool: 100000002 } as const;

// Opening hours and slot size
export const OPENING_HOUR = 7;
export const CLOSING_HOUR = 23;
export const SLOT_MINUTES = 30;
