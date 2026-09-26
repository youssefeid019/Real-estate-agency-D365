using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace YE.Plugins
{
    // Custom API: creates one Confirmed booking per session of a won deal
    public class CreateBlockBookingsApi : IPlugin
    {
        private const int StatusDraft = 100000000;
        private const int StatusConfirmed = 100000001;
        private const int PaymentAwaiting = 100000000;
        private const int StatusCancelled = 100000002;
        private const int FacilityAvailable = 100000000;
        private const int FrequencyWeekly = 100000000;
        private const int FrequencyFortnightly = 100000001;
        private const int FrequencyDaily = 100000002;

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);

            // Run for the opportunity in the caller's time zone
            var opportunityId = (Guid)context.InputParameters["OpportunityId"];
            var result = Run(service, opportunityId, TimeZoneOf(service, context.InitiatingUserId));
            context.OutputParameters["Created"] = result.Created;
            context.OutputParameters["Unscheduled"] = result.Unscheduled;
        }

        public struct Result { public int Created; public int Unscheduled; }

        // Plans and creates the session bookings for a deal
        public static Result Run(IOrganizationService service, Guid opportunityId, int? timeZoneCode)
        {
            // Do nothing if the deal already has bookings
            var existing = new QueryExpression("ye_booking") { ColumnSet = new ColumnSet(false), TopCount = 1 };
            existing.Criteria.AddCondition("ye_opportunity", ConditionOperator.Equal, opportunityId);
            if (service.RetrieveMultiple(existing).Entities.Count > 0)
                return new Result();

            var opp = service.Retrieve("opportunity", opportunityId, new ColumnSet(
                "ye_facility", "parentaccountid", "parentcontactid", "ye_firstsession", "ye_sessions", "ye_sessionhours", "ye_frequency"));
            var facility = opp.GetAttributeValue<EntityReference>("ye_facility");
            var member = opp.GetAttributeValue<EntityReference>("parentaccountid") ?? opp.GetAttributeValue<EntityReference>("parentcontactid");
            if (facility == null || member == null)
                return new Result();

            var first = opp.GetAttributeValue<DateTime?>("ye_firstsession");
            var hours = opp.GetAttributeValue<decimal?>("ye_sessionhours");
            var sessions = opp.GetAttributeValue<int?>("ye_sessions") ?? 1;
            // No schedule: a single untimed Draft
            if (first == null || hours == null || hours <= 0)
            {
                service.Create(Unscheduled(facility, member, opportunityId, null));
                return new Result { Unscheduled = 1 };
            }

            // Days between sessions
            int stepDays;
            switch (opp.GetAttributeValue<OptionSetValue>("ye_frequency")?.Value ?? FrequencyWeekly)
            {
                case FrequencyDaily: stepDays = 1; break;
                case FrequencyFortnightly: stepDays = 14; break;
                default: stepDays = 7; break;
            }

            var available = service.Retrieve("ye_facility", facility.Id, new ColumnSet("ye_availabilitystatus"))
                .GetAttributeValue<OptionSetValue>("ye_availabilitystatus")?.Value == FacilityAvailable;

            // One Confirmed booking per session; clashes become untimed Drafts with a note
            var firstLocal = ToLocal(service, first.Value, timeZoneCode);
            var result = new Result();
            var planned = new List<Tuple<DateTime, DateTime>>();
            for (int i = 0; i < sessions; i++)
            {
                var startLocal = firstLocal.AddDays(i * stepDays);
                var start = ToUtc(service, startLocal, timeZoneCode);
                var end = start.AddHours((double)hours.Value);
                string problem = !available
                    ? "the facility was under maintenance when the deal was won"
                    : planned.Any(p => p.Item1 < end && p.Item2 > start) || IsTaken(service, facility.Id, start, end)
                        ? "the slot was already booked"
                        : null;
                var label = $"Session {i + 1} of {sessions}: {startLocal:ddd d MMM yyyy HH:mm} for {hours.Value:0.##} h";
                if (problem == null)
                {
                    service.Create(Confirmed(facility, member, opportunityId, start, end, label));
                    planned.Add(Tuple.Create(start, end));
                    result.Created++;
                }
                else
                {
                    service.Create(Unscheduled(facility, member, opportunityId, $"{label}: not scheduled, {problem}. Pick another time."));
                    result.Unscheduled++;
                }
            }
            return result;
        }

        // A scheduled session: Confirmed with its times, awaiting payment; the plugins price it
        private static Entity Confirmed(EntityReference facility, EntityReference member, Guid opportunityId, DateTime start, DateTime end, string note)
        {
            var booking = Booking(StatusConfirmed, facility, member, opportunityId, note);
            booking["ye_starttime"] = start;
            booking["ye_endtime"] = end;
            booking["ye_paymentstatus"] = new OptionSetValue(PaymentAwaiting);
            return booking;
        }

        // A session that couldn't be placed: an untimed Draft for the coordinator
        private static Entity Unscheduled(EntityReference facility, EntityReference member, Guid opportunityId, string note) =>
            Booking(StatusDraft, facility, member, opportunityId, note);

        // Fields every session booking shares
        private static Entity Booking(int status, EntityReference facility, EntityReference member, Guid opportunityId, string note)
        {
            var booking = new Entity("ye_booking")
            {
                ["ye_status"] = new OptionSetValue(status),
                ["ye_facility"] = facility,
                ["ye_customer"] = member,
                ["ye_opportunity"] = new EntityReference("opportunity", opportunityId),
            };
            if (note != null) booking["ye_schedulingnote"] = note;
            return booking;
        }

        // True if a non-cancelled booking overlaps the slot
        private static bool IsTaken(IOrganizationService service, Guid facilityId, DateTime start, DateTime end)
        {
            var q = new QueryExpression("ye_booking") { ColumnSet = new ColumnSet(false), TopCount = 1 };
            q.Criteria.AddCondition("ye_facility", ConditionOperator.Equal, facilityId);
            q.Criteria.AddCondition("ye_status", ConditionOperator.NotEqual, StatusCancelled);
            q.Criteria.AddCondition("ye_starttime", ConditionOperator.LessThan, end);
            q.Criteria.AddCondition("ye_endtime", ConditionOperator.GreaterThan, start);
            return service.RetrieveMultiple(q).Entities.Count > 0;
        }

        // The user's time zone code
        private static int? TimeZoneOf(IOrganizationService service, Guid userId)
        {
            var q = new QueryExpression("usersettings") { ColumnSet = new ColumnSet("timezonecode"), TopCount = 1 };
            q.Criteria.AddCondition("systemuserid", ConditionOperator.Equal, userId);
            return service.RetrieveMultiple(q).Entities.FirstOrDefault()?.GetAttributeValue<int?>("timezonecode");
        }

        // UTC to the user's local time
        private static DateTime ToLocal(IOrganizationService service, DateTime utc, int? timeZoneCode) =>
            timeZoneCode == null ? utc
            : ((LocalTimeFromUtcTimeResponse)service.Execute(new LocalTimeFromUtcTimeRequest { TimeZoneCode = timeZoneCode.Value, UtcTime = DateTime.SpecifyKind(utc, DateTimeKind.Utc) })).LocalTime;

        // User's local time to UTC
        private static DateTime ToUtc(IOrganizationService service, DateTime local, int? timeZoneCode) =>
            timeZoneCode == null ? DateTime.SpecifyKind(local, DateTimeKind.Utc)
            : ((UtcTimeFromLocalTimeResponse)service.Execute(new UtcTimeFromLocalTimeRequest { TimeZoneCode = timeZoneCode.Value, LocalTime = DateTime.SpecifyKind(local, DateTimeKind.Unspecified) })).UtcTime;
    }
}
