using System;
using Microsoft.Xrm.Sdk;

namespace YE.Plugins
{
    // Prices a block booking deal from its sessions and the facility rate
    public class OpportunityPricingPlugin : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(null);

            if (!context.InputParameters.Contains("Target") || !(context.InputParameters["Target"] is Entity target))
                return;
            if (target.LogicalName != "opportunity")
                return;

            // Read each field from the change or the saved record
            var preImage = context.PreEntityImages.Contains("PreImage") ? context.PreEntityImages["PreImage"] : new Entity("opportunity");
            T Current<T>(string attribute) => target.Contains(attribute) ? target.GetAttributeValue<T>(attribute) : preImage.GetAttributeValue<T>(attribute);

            var facility = Current<EntityReference>("ye_facility");
            var sessions = Current<int?>("ye_sessions");
            var hours = Current<decimal?>("ye_sessionhours");
            if (facility == null || sessions == null || hours == null || sessions <= 0 || hours <= 0)
                return;

            // List price: sessions x hours x hourly rate
            var rate = service.Retrieve("ye_facility", facility.Id, new Microsoft.Xrm.Sdk.Query.ColumnSet("ye_hourlyrate"))
                .GetAttributeValue<Money>("ye_hourlyrate")?.Value ?? 0m;
            var listPrice = Math.Round(sessions.Value * hours.Value * rate, 2, MidpointRounding.AwayFromZero);

            // Proposal value follows the list price until negotiated
            var previousListPrice = preImage.GetAttributeValue<Money>("ye_listprice")?.Value;
            var proposal = Current<Money>("estimatedvalue")?.Value;
            bool proposalSetNow = target.Contains("estimatedvalue");
            if (!proposalSetNow && (proposal == null || proposal == previousListPrice))
                target["estimatedvalue"] = new Money(listPrice);

            target["ye_listprice"] = new Money(listPrice);
        }
    }
}
