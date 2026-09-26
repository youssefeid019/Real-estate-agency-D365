using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace YE.Plugins
{
    // Blocks invalid or double bookings before they are saved
    public class BookingOverlapValidationPlugin : IPlugin
    {
        private const int StatusCancelled = 100000002;
        private const int StatusCompleted = 100000003;
        private const int FacilityAvailable = 100000000;

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            // Read as SYSTEM so the check sees every booking
            var service = factory.CreateOrganizationService(null);

            if (!context.InputParameters.Contains("Target") || !(context.InputParameters["Target"] is Entity target))
                return;
            if (target.LogicalName != "ye_booking")
                return;

            // Merge the changed fields with the saved record
            var preImage = context.PreEntityImages.Contains("PreImage")
                ? context.PreEntityImages["PreImage"]
                : new Entity(target.LogicalName);

            var facility = target.Contains("ye_facility")
                ? target.GetAttributeValue<EntityReference>("ye_facility")
                : preImage.GetAttributeValue<EntityReference>("ye_facility");
            DateTime? start = target.Contains("ye_starttime")
                ? target.GetAttributeValue<DateTime?>("ye_starttime")
                : preImage.GetAttributeValue<DateTime?>("ye_starttime");
            DateTime? end = target.Contains("ye_endtime")
                ? target.GetAttributeValue<DateTime?>("ye_endtime")
                : preImage.GetAttributeValue<DateTime?>("ye_endtime");
            var status = target.Contains("ye_status")
                ? target.GetAttributeValue<OptionSetValue>("ye_status")
                : preImage.GetAttributeValue<OptionSetValue>("ye_status");

            if (facility == null || start == null || end == null)
                return;

            // End must be after start
            if (end.Value <= start.Value)
                throw new InvalidPluginExecutionException("The booking's end time must be after its start time.");

            // Closing a booking never needs checking
            if (status != null && (status.Value == StatusCancelled || status.Value == StatusCompleted))
                return;

            // Refuse facilities under maintenance
            var facilityRecord = service.Retrieve("ye_facility", facility.Id, new ColumnSet("ye_availabilitystatus"));
            var availability = facilityRecord.GetAttributeValue<OptionSetValue>("ye_availabilitystatus");
            if (availability != null && availability.Value != FacilityAvailable)
                throw new InvalidPluginExecutionException("This facility is currently under maintenance and cannot be booked.");

            // Find non-cancelled bookings that overlap this time range
            var query = new QueryExpression("ye_booking")
            {
                ColumnSet = new ColumnSet(false),
                Criteria = new FilterExpression(LogicalOperator.And)
                {
                    Conditions =
                    {
                        new ConditionExpression("ye_facility", ConditionOperator.Equal, facility.Id),
                        new ConditionExpression("ye_status", ConditionOperator.NotEqual, StatusCancelled),
                        new ConditionExpression("ye_starttime", ConditionOperator.LessThan, end.Value),
                        new ConditionExpression("ye_endtime", ConditionOperator.GreaterThan, start.Value),
                    }
                }
            };

            // Ignore the booking itself on update
            if (target.Id != Guid.Empty)
                query.Criteria.AddCondition("ye_bookingid", ConditionOperator.NotEqual, target.Id);

            var conflicts = service.RetrieveMultiple(query);
            if (conflicts.Entities.Count > 0)
            {
                throw new InvalidPluginExecutionException(
                    "This facility is already booked for part of the selected time range. Please choose a different time or facility.");
            }
        }
    }
}
