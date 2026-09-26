# YE Sports Facility

A Dynamics 365 / Dataverse solution for a sports facility business: facilities, memberships and bookings; a sales cycle for group and corporate block bookings; a case cycle for facility problems; and a customer portal on Vercel.

- **CRM:** model-driven app *YE Sports Facility* in `https://yesportsfacilitydev.crm4.dynamics.com`, solution **YESportsFacility** (publisher *YE*, prefix `ye`)
- **Portal:** https://ye-sports-portal.vercel.app (Next.js, `portal/`)

## What was built

All nine requirements, plus these optional extras: plugin unit tests, the unpacked solution in Git, and a note on loading historical bookings (below). On top of the brief:

- Sales and case cycles, each with a business process flow
- Block bookings: one Draft booking per session of a won deal
- Payment tracking and refunds
- Automatic handling of bookings affected by maintenance
- Case escalation
- A home page and a maintenance cases page in the app
- The customer portal

**Not done:**
- **The canvas app** for today's bookings. The *Upcoming Confirmed Bookings* view covers the same need.
- **The email flows** are in the solution but off. They need an Office 365 Outlook connection, which requires an interactive sign-in.
- **Online payment.** Payment is taken at reception and recorded on the booking.

## Approach per requirement

| # | Requirement | Approach | Why |
|---|---|---|---|
| 1 | Solution packaging | Configuration: publisher *YE* (`ye`), solution *YESportsFacility*; `dist/` holds the unmanaged and managed exports | Standard ALM. The managed export is what a test or production environment gets |
| 2 | Data model | Configuration: tables Facility, Booking and Membership. Facility Type is a **global choice**. Facility code is an **alternate key**. Member is a lookup to **Contact** (or Account for corporate bookings) | A global choice can be reused on other tables with no lookup table. The alternate key lets the external system call `/ye_facilities(ye_facilitycode='P-01')` with no custom API. Members stay in Contact, where people are already tracked |
| 3 | Prevent double-booking | **Plugin** (pre-operation, synchronous, Create + Update) | Only a server-side, in-transaction check holds for the form, imports and API calls alike, and it can't be bypassed from the browser. Its lookups run as SYSTEM, so a user can't double-book over bookings they can't see. The thrown message tells the user which booking clashes |
| 4 | Price the booking | **Plugin** (pre-operation, runs after validation) | The price needs the facility's rate and the member's active membership, which are other tables, so a calculated column or business rule can't produce it. It re-prices on every reschedule. Total price is read-only on the form |
| 5 | Sales hand-off | **Cloud flow** on Opportunity won, which calls the **Custom API** `ye_CreateBlockBookings` | The flow is visible and easy to change. The Custom API holds the per-session scheduling logic, which is too involved for flow actions. It's idempotent, so re-winning a deal doesn't create duplicates |
| 6 | Booking form | Hourly rate: Facility **quick view form**. End before start: **business rule** (entity scope). Cancellation reason: **business rule** | A quick view form shows related data with no code. Business rules with entity scope are also enforced on the server, so the portal and the API get them too. The cancellation rule is configured, as the brief required |
| 7 | Maintenance | Case with a Facility lookup, **routing rule** to the *Facility Maintenance* queue, and **cloud flows** that set the facility's status | Queues and routing are the platform's own work-distribution features. Status sync is asynchronous by nature, so flows fit. The overlap plugin refuses bookings for a facility under maintenance, and the facility is released only when no other open case still has it out of service |
| 8 | Security | **Configuration:** business units and roles (next section) | Location is a business unit, so "own location" maps onto business-unit privilege depth, the platform's own mechanism, with no code |
| 9 | README | This file | |

## Security structure

- **Business units:** one per location (`Location - North`, `Location - South`) under the root business unit. Users and their bookings sit in their location's business unit.
- **YE Coordinator:** Booking Create/Read/Write/Assign at **business unit** depth, so they only see and work their own location's bookings. Facilities, memberships and contacts are readable organisation-wide. No role has Delete on Facility.
- **YE Manager:** Read at **organisation** depth on bookings and the related tables, and nothing else.
- **YE Portal Integration:** the portal's application user. It can create and update bookings and contacts, and has no Delete privilege at all.

Both people roles are assigned alongside Basic User. Business-unit depth was chosen over teams or sharing because location is a fixed attribute of a user, and the depth model enforces it with no extra records to maintain. The plugins read as SYSTEM so that scoping never weakens the overlap check.

## Web resources

| Name | Type | What it does |
|---|---|---|
| `ye_/pages/home.html` | HTML | The app's landing page, *Sales & bookings*. It shows the sales cycle's stages, *+ New group enquiry*, a *Book a facility* button, live counters (open enquiries, open deals, drafts to schedule, facilities out of service) that open their views, and the latest enquiries |
| `ye_/scripts/home.js` | JS | Script for the home page. It loads the counters and the latest enquiries from the Web API as the signed-in user, so each user sees only what their role allows |
| `ye_/pages/cases.html` | HTML | The *Maintenance cases* page. Flag a new case for a facility, find a case by number, title or facility, and see maintenance counters |
| `ye_/scripts/cases.js` | JS | Script for the cases page. It opens the case form pre-filled with the facility, priority and out-of-service flag. It also runs the case search and loads the counters (open, out of service, escalated, bookings to move) |
| `ye_/scripts/booking_form.js` | JS | Booking form script (OnLoad and OnChange). It warns when the chosen facility is under maintenance and shows an estimated price until the plugin sets the real one. This is feedback only: the rules themselves are enforced on the server |
| `ye_/scripts/commands.js` | JS | Command bar actions. *Book facility* opens a new booking pre-filled from the current Facility, Contact, Account or Opportunity |
| `ye_/icons/*.svg` | SVG | Table and site-map icons: account, booking, enquiry, facility, home, maintenance, member, membership, opportunity, queue |

## Plugins

Assembly `YE.Plugins` (net462, signed). All steps are synchronous, pre-operation.

| Plugin | Step | What it does |
|---|---|---|
| `BookingOverlapValidationPlugin` | Create, Update of `ye_booking` (facility, start, end, status) | Rejects a booking that overlaps a non-cancelled booking on the same facility, is for a facility under maintenance, or ends before it starts. Registered with a lower rank than pricing, so it runs first |
| `BookingPricingPlugin` | Create, Update of `ye_booking` (facility, member, start, end, status) | Sets total price to duration × hourly rate, less the membership discount for a contact member with an active membership. The price is frozen once the booking is completed or cancelled |
| `BookingPaymentPlugin` | Update of `ye_booking` (status) | When a paid booking is cancelled, sets its payment status to *Refund Due* |
| `OpportunityPricingPlugin` | Create, Update of `opportunity` (facility, sessions, session hours) | Sets list price to sessions × hours × hourly rate. Proposal value follows the list price until the salesperson negotiates it |
| `CreateBlockBookingsApi` | Custom API `ye_CreateBlockBookings` | Turns a won deal into one Draft booking per session (weekly, fortnightly or daily). A session whose slot is taken, or whose facility is closed, becomes an untimed Draft with a note for the coordinator |

## Active flows

| Flow | Trigger | What it does |
|---|---|---|
| YE - Opportunity Won: Create Draft Booking | Opportunity won | Calls `ye_CreateBlockBookings` to create the Draft bookings, unless the deal already has bookings |
| YE - Block Booking Lost: Follow-up Task | Block booking opportunity lost | Creates a follow-up task for the salesperson |
| YE - Web Enquiry: Assign to Corporate Sales | Portal creates a lead | Assigns the lead to the Corporate Sales Team |
| YE - Web Enquiry: Follow-up Task | Web lead created | Creates a call-back task |
| YE - Maintenance Case Logged: Route to Queue | Case logged against a facility | Routes the case to the Facility Maintenance queue |
| YE - Maintenance Case Out of Service: Facility Under Maintenance | Case marked as taking its facility out of service | Sets the facility to *Under Maintenance* |
| YE - Maintenance Case Closed or Cleared: Facility Available | Case resolved, cancelled or no longer out of service | Sets the facility back to *Available* when no other open case keeps it closed |
| YE - Facility Out of Service: Open Maintenance Case | Facility closed by hand | Opens a maintenance case if no open case covers it |
| YE - Maintenance: Flag Affected Bookings | Case closes a facility | Flags the facility's upcoming bookings as affected, so they can be moved |
| YE - Maintenance: Escalate Overdue Cases | Every hour | Escalates open maintenance cases that have been open too long for their priority |
| YE - Bookings: Complete Past Bookings | Every hour | Marks confirmed bookings whose end time has passed as *Completed* |

The two business process flows, *YE Corporate Booking Process* and *YE Facility Maintenance Process*, and the three booking business rules are active too.

## Assumptions

- A membership belongs to a person, so the discount applies to contact members only. The discount percentage is stored on the membership.
- Draft bookings (from the sales hand-off) may have no times. Every other status requires them (business rule).
- Portal customers aren't Dataverse users. They manage a booking with its reference and email. This is fine for the exercise but not hardened for production.

## Loading 500 historical bookings

Use a dataflow or the Configuration Migration Tool, keyed on the facility's **alternate key** (`ye_facilitycode`) and the member's email. Load them in time order with the status they already had. The overlap plugin will reject real clashes in the source data, which is what we want, and those rows go back to the business to resolve. Plugins stay on so prices are recalculated consistently. If historical prices must be kept as they were, load them with a bypass flag (`BypassCustomPluginExecution`) run by an admin, then spot-check.

## With another week / weakest part

- **Another week:** the canvas app, and binding the Outlook connection to turn on the emails. I'd also add a CI pipeline (build, unit tests, `pac solution check`, export) and deployment settings files so connection references and environment variables need no manual steps. Last, real authentication for the portal.
- **Weakest part:** the portal's identity model (reference + email, no rate limiting) and its password sign-in. Also, after an import some environment data (teams, queue, internal account) has to be created by hand, and flows that name a team or queue have to be re-pointed.

## Repository

| Folder | What |
|---|---|
| `solution/` | The unpacked **unmanaged** solution (`pac solution unpack`), as source |
| `dist/` | Exported solutions: `YESportsFacility.zip` (unmanaged) and `YESportsFacility_managed.zip` (managed) |
| `plugins/YE.Plugins` | C# plugins and the Custom API |
| `plugins/YE.Plugins.Tests` | Plugin unit tests (xUnit + FakeXrmEasy v1) |
| `webresources/` | Web resource source (HTML and JS) |
| `portal/` | Customer portal and its REST API |

## Deploying to another environment

1. Import `dist/YESportsFacility_managed.zip` (or the unmanaged zip for a dev environment): **make.powerapps.com → Solutions → Import**.
2. During import, bind the connection references:
   - **`ye_sharedcommondataserviceforapps_booking`** (Microsoft Dataverse): required by every flow
   - **`ye_sharedoffice365_notifications`** (Office 365 Outlook): only the *YE - Email* flows use it
3. Set the environment variable **Maintenance Team Email** (`ye_MaintenanceTeamEmail`).
4. Create the **data the solution can't carry** (below), then turn on any flows that are off.

### What the solution can't carry

These are records, not customisations, so they're created per environment:

| Needed by | Record |
|---|---|
| Case routing, maintenance flows | **Facility Maintenance** queue, set as the **YE - Case Routing** rule's queue |
| Sales and case cycles | Owner teams **Corporate Sales Team** (Salesperson) and **Facility Maintenance Team** (YE Coordinator), with the queue as the team's default |
| Automatic cases for hand-closed facilities | Account **YE Sports Facilities (Internal)** |
| Security | Business units per location, the **Portal Integration** application user |
| Emails | An Office 365 Outlook **connection** (interactive sign-in), bound to `ye_sharedoffice365_notifications` |

After creating them, open the flows that name a team or queue (web enquiry assignment and follow-up, case routing) and point them at the new environment's records.

To refresh `solution/` and `dist/` after a change:

```
pac solution export --name YESportsFacility --path dist/YESportsFacility.zip --overwrite
pac solution export --name YESportsFacility --path dist/YESportsFacility_managed.zip --managed --overwrite
pac solution unpack --zipfile dist/YESportsFacility.zip --folder solution --packagetype Unmanaged --allowDelete true --allowWrite true
```

## Portal

`portal/` is a Next.js app. Its API routes call the Dataverse Web API as the Portal Integration application user. Configure it through `portal/.env.local` locally, or in the Vercel project settings:

| Variable | Purpose |
|---|---|
| `DATAVERSE_URL` | The environment URL |
| `DATAVERSE_TENANT_ID` | Entra tenant |
| `DATAVERSE_USERNAME`, `DATAVERSE_PASSWORD` | Service account that signs in (ROPC) |
| `DATAVERSE_CALLER_ID` | The Portal Integration user's `systemuserid`, impersonated so the portal only has that role's rights |

Or use client credentials (`DATAVERSE_CLIENT_ID` + `DATAVERSE_CLIENT_SECRET`) when a secret is available.

```
cd portal
npm install
npm run dev              # http://localhost:3000
vercel deploy --prod     # production
```

## Tests

| Suite | Runs | Checks |
|---|---|---|
| `dotnet test plugins/YE.Plugins.Tests` | In memory | 29: overlap, pricing, discounts, payment, list price, block-booking generation |

