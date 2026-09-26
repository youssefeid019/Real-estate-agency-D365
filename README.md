# YE Sports Facility

Dynamics 365 solution for the community sports facilities scenario, plus a customer portal and a phone app.

- CRM: https://yesportsfacilitydev.crm4.dynamics.com (model-driven app "YE Sports Facility")
- Portal: https://ye-sports-portal.vercel.app
- Phone app "Today's Bookings": https://apps.powerapps.com/play/e/b154a431-346f-ea58-ba4d-ed6cf315ad5c/a/aba57c0e-4c0f-4f76-b360-52fbeb857590

Folders: `dist/` (managed and unmanaged exports), `solution/` (unpacked), `plugins/` (with unit tests: `dotnet test plugins/YE.Plugins.Tests`), `webresources/`, `portal/` (Next.js, `npm install && npm run dev`), `canvasapp/`.

## What I built, and what I didn't

All the requirements. Beyond them: plugin unit tests, the solution unpacked in Git, a business process flow for corporate block bookings and another for maintenance, a home page and a cases page in the app, a phone app showing a facility's bookings for today, and a portal where customers book, reschedule or cancel, send a group enquiry and report a facility problem.

Not done: the email flows are built but switched off, because they need an Outlook connection signed in by hand. Business units, teams, the queue and the internal account can't travel in a solution, so a new environment needs them created once before the flows are pointed at them and turned on.

## Approach per requirement

| # | Requirement | Approach | Why |
|---|---|---|---|
| 1 | Solution packaging | Configuration | One unmanaged solution, publisher prefix `ye`, exported managed and unmanaged. Nothing to code. |
| 2 | Data model | Configuration | Facility, Booking and Membership tables; members are Contacts. Facility Type is a global choice so other tables can reuse it. The facility code is an alternate key so the scheduling system can address a facility (`ye_facilities(ye_facilitycode='PITCH-5A')`) without a Dynamics ID. |
| 3 | No double-booking | Plugin (sync, pre-operation, create and update) | It has to hold for the form, imports, the portal and the API, and must not be bypassable from the browser. Only server-side code covers every path. It queries as SYSTEM so a user can't book over bookings they can't see. |
| 4 | Price | Plugin | Duration × hourly rate less the member's active membership discount needs data from two other tables, which a calculated column or business rule can't reach. Recalculated on every reschedule; read-only on the form. |
| 5 | Sales hand-off | Flow + custom API | The trigger (opportunity won) is a flow's job and easy for an admin to change; creating one booking per session with overlap handling is logic, so it lives in a tested custom API. Sessions are booked Confirmed because the times were agreed in the deal; a session whose slot is taken becomes a Draft with a note. |
| 6 | Booking form | Configuration (quick view + business rules) | Showing the hourly rate, blocking end before start, and showing/requiring the cancellation reason are all declarative, so no script is needed. A small form script only adds a maintenance warning and a price estimate before save. |
| 7 | Maintenance | Configuration + flows | A Facility lookup on Case and a routing rule to the Facility Maintenance queue are standard features. Flows flip the facility to Under Maintenance and back on resolve; the overlap plugin then refuses bookings for it, so no extra code was needed. |
| 8 | Security | Configuration (business units + roles) | Each location is a business unit. Coordinators get booking create/read/write at business-unit depth, managers read at organisation depth, facilities are read-only and nobody can delete them. A user's location rarely changes, and privilege depth enforces it with no sharing records or code. |

## With another week, and the weakest part

The weakest part is how the portal signs in to Dataverse. I couldn't create a client secret in the tenant, so it uses password sign-in for a service user and impersonates an application user. It works, and the password is stored encrypted, but password sign-in is deprecated, breaks the moment MFA is enforced on that account, and is not what I'd ship. With another week, and the rights to do it, I'd register an app with a certificate and use a proper application user.

Next I'd close the gap in the double-booking check: two bookings for the same slot saved at the same instant can both pass the query. I'd serialise them by locking the facility row in the same transaction (an update to the facility before the query) and add a test that runs concurrent creates.

I'd also set up a pipeline (build, test, pack and import the solution to a test environment), turn on the email flows with a shared mailbox connection, cover the flows with tests the way the plugins are, and script the one-off setup records so a new environment comes up in one step.
