# YE Sports Facility

Dynamics 365 solution for the community sports facilities scenario, plus a customer portal.

- CRM: https://yesportsfacilitydev.crm4.dynamics.com (model-driven app "YE Sports Facility")
- Customer portal, live: https://ye-sports-portal.vercel.app
- Phone app "Today's Bookings": https://apps.powerapps.com/play/e/b154a431-346f-ea58-ba4d-ed6cf315ad5c/a/aba57c0e-4c0f-4f76-b360-52fbeb857590

Folders: `dist/` (unmanaged and managed exports), `solution/` (unpacked solution), `plugins/`, `webresources/`, `portal/`, `canvasapp/` (screens of the phone app).

## What I built

All nine requirements. On top of them: plugin unit tests, the solution unpacked in Git, a canvas app for phones showing a facility's bookings for today, a sales process for corporate block bookings, a maintenance process with a case queue, and a portal where customers book, reschedule or cancel, send a group enquiry and report a facility problem.

Not done: the email flows are built but switched off, because they need an Outlook connection signed in by hand.

## Approach per requirement

1. **Solution packaging** (configuration). One unmanaged solution, YESportsFacility, publisher YE with prefix `ye`. Exported as unmanaged and managed.
2. **Data model** (configuration). Facility, Booking and Membership tables. Facility Type is a global choice so other tables can reuse it. The facility code is an alternate key, so the scheduling system can read and update a facility with `ye_facilities(ye_facilitycode='PITCH-5A')` and no Dynamics ID. Members are Contacts.
3. **Double-booking** (plugin). A synchronous pre-operation plugin on create and update rejects an overlap with any non-cancelled booking on the same facility. Being server-side, it applies to the form, imports and the API, and can't be bypassed from the browser. It queries as SYSTEM so a user can't book over bookings they can't see.
4. **Price** (plugin). Duration x hourly rate, less the discount of the member's active membership. It needs data from other tables, so a calculated column or business rule can't do it. It runs on every reschedule, and the field is read-only on the form.
5. **Sales hand-off** (flow + custom API). A flow on Opportunity won calls a custom API that books every session of the deal, linked to the opportunity. I book the sessions as Confirmed rather than Draft, since the times are agreed in the deal; a session whose slot is taken becomes a Draft with a note for the coordinator.
6. **Booking form** (configuration). A Facility quick view form shows the hourly rate. Business rules stop an end time before the start time, and show and require the cancellation reason when the status is Cancelled.
7. **Maintenance** (configuration + flows). Cases have a Facility lookup and a routing rule sends them to the Facility Maintenance queue. A flow sets the facility to Under Maintenance, the overlap plugin then refuses bookings for it, and another flow sets it back to Available when the case is resolved.
8. **Security** (configuration). See below.

## Security

Each location is a business unit (Location - North, Location - South). The Coordinator role has create, read and write on bookings at business unit level, so a coordinator only works with their own location's bookings; facilities are read only and no role can delete them. The Manager role reads bookings at organisation level. I used business units because a user's location doesn't change often and the privilege depth enforces it without any extra records or code.

## Running it in another environment

1. Import `dist/YESportsFacility_managed.zip` in make.powerapps.com, Solutions, Import.
2. Bind the Dataverse connection (and Outlook if you want the emails), then set the environment variable Maintenance Team Email.
3. Create the records a solution can't carry: the two location business units, the Corporate Sales Team and Facility Maintenance Team, the Facility Maintenance queue (set it on the YE - Case Routing rule) and the account "YE Sports Facilities (Internal)". Point the web enquiry and case routing flows at the new team and queue, and turn the flows on.
4. For the portal, create an application user with the YE Portal Integration role and note its user ID.
5. In the Vercel project (or `portal/.env.local`) set `DATAVERSE_URL`, `DATAVERSE_TENANT_ID`, `DATAVERSE_USERNAME`, `DATAVERSE_PASSWORD`, `DATAVERSE_CALLER_ID` (the application user's ID) and `DATAVERSE_SECRET_KEY`. The password is stored encrypted: `node encrypt-secret.mjs .env.local DATAVERSE_PASSWORD` encrypts it and gives you the key.
6. Deploy with `vercel deploy --prod`, then book a slot on the portal and check it appears in the CRM with its price.
7. The Today's Bookings app comes with the solution and reads Dataverse directly, so it needs no connection. Share it with the staff who should use it (make.powerapps.com, Apps, Share).

## Web resources

- `ye_/pages/home.html` and `ye_/scripts/home.js`: the app's home page. Starts a group enquiry or a booking and shows counters for open enquiries, open deals, drafts to schedule and facilities out of service.
- `ye_/pages/cases.html` and `ye_/scripts/cases.js`: maintenance cases page. Flag a case for a facility, search cases, see open, out of service and escalated counts.
- `ye_/scripts/booking_form.js`: booking form script. Warns when the facility is under maintenance and shows an estimated price before saving.
- `ye_/scripts/commands.js`: the "Book facility" button, which opens a new booking filled in from the current facility, contact, account or opportunity.

## Plugins

- `BookingOverlapValidationPlugin`: rejects overlapping bookings, bookings for a facility under maintenance, and an end time before the start time.
- `BookingPricingPlugin`: sets the total price from the duration, hourly rate and membership discount.
- `BookingPaymentPlugin`: a paid booking that gets cancelled becomes Refund Due.
- `OpportunityPricingPlugin`: list price of a deal = sessions x hours x hourly rate.
- `CreateBlockBookingsApi`: custom API `ye_CreateBlockBookings`, books every session of a won deal.

## Active flows

- Opportunity Won: Create Draft Booking: calls the custom API to book the deal's sessions.
- Block Booking Lost: Follow-up Task
- Web Enquiry: Assign to Corporate Sales, and Web Enquiry: Follow-up Task
- Maintenance Case Logged: Route to Queue
- Maintenance Case Out of Service: Facility Under Maintenance
- Maintenance Case Closed or Cleared: Facility Available
- Facility Out of Service: Open Maintenance Case
- Maintenance: Flag Affected Bookings
- Maintenance: Escalate Overdue Cases (hourly)
- Bookings: Complete Past Bookings (hourly)

## Running the portal and tests

```
cd portal
npm install
npm run dev
```

Plugin unit tests: `dotnet test plugins/YE.Plugins.Tests`.

