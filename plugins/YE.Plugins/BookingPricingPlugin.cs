using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace YE.Plugins
{
    // Sets the booking's total price from its duration and the facility rate
    public class BookingPricingPlugin : IPlugin
    {
        private const int MembershipActive = 100000000;
        private const int StatusCancelled = 100000002;
        private const int StatusCompleted = 100000003;

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            // Read as SYSTEM so the price doesn't depend on the caller
            var service = factory.CreateOrganizationService(null);

            if (!context.InputParameters.Contains("Target") || !(context.InputParameters["Target"] is Entity target))
                return;
            if (target.LogicalName != "ye_booking")
                return;

            // Keep the price of a completed or cancelled booking
            var newStatus = target.GetAttributeValue<OptionSetValue>("ye_status");
            bool closing = newStatus != null && (newStatus.Value == StatusCompleted || newStatus.Value == StatusCancelled);
            bool bookingChanged = target.Contains("ye_facility") || target.Contains("ye_customer") || target.Contains("ye_starttime") || target.Contains("ye_endtime");
            if (closing && !bookingChanged && context.MessageName == "Update")
                return;

            // Merge the changed fields with the saved record
            var preImage = context.PreEntityImages.Contains("PreImage")
                ? context.PreEntityImages["PreImage"]
                : new Entity(target.LogicalName);

            var facilityRef = target.Contains("ye_facility")
                ? target.GetAttributeValue<EntityReference>("ye_facility")
                : preImage.GetAttributeValue<EntityReference>("ye_facility");
            var memberRef = target.Contains("ye_customer")
                ? target.GetAttributeValue<EntityReference>("ye_customer")
                : preImage.GetAttributeValue<EntityReference>("ye_customer");
            DateTime? start = target.Contains("ye_starttime")
                ? target.GetAttributeValue<DateTime?>("ye_starttime")
                : preImage.GetAttributeValue<DateTime?>("ye_starttime");
            DateTime? end = target.Contains("ye_endtime")
                ? target.GetAttributeValue<DateTime?>("ye_endtime")
                : preImage.GetAttributeValue<DateTime?>("ye_endtime");

            if (facilityRef == null || start == null || end == null || end.Value <= start.Value)
                return;

            // Base price: hours x hourly rate
            var facility = service.Retrieve("ye_facility", facilityRef.Id, new ColumnSet("ye_hourlyrate"));
            var hourlyRate = facility.GetAttributeValue<Money>("ye_hourlyrate");
            decimal rate = hourlyRate?.Value ?? 0m;

            decimal hours = (decimal)(end.Value - start.Value).TotalHours;
            decimal price = hours * rate;

            // Apply the discount of a person's active membership
            if (memberRef != null && memberRef.LogicalName == "contact")
            {
                var membershipQuery = new QueryExpression("ye_membership")
                {
                    ColumnSet = new ColumnSet("ye_discountpercentage"),
                    Criteria = new FilterExpression(LogicalOperator.And)
                    {
                        Conditions =
                        {
                            new ConditionExpression("ye_member", ConditionOperator.Equal, memberRef.Id),
                            new ConditionExpression("ye_status", ConditionOperator.Equal, MembershipActive),
                        }
                    },
                    TopCount = 1
                };
                var memberships = service.RetrieveMultiple(membershipQuery);
                if (memberships.Entities.Count > 0)
                {
                    var discountPct = memberships.Entities[0].GetAttributeValue<decimal?>("ye_discountpercentage") ?? 0m;
                    price *= 1 - discountPct / 100m;
                }
            }

            // Round and set the total price
            price = Math.Round(price, 2, MidpointRounding.AwayFromZero);
            target["ye_totalprice"] = new Money(price);
        }
    }
}
