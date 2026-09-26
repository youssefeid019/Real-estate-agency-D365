using System;
using Microsoft.Xrm.Sdk;

namespace YE.Plugins
{
    // Marks a cancelled paid booking as refund due
    public class BookingPaymentPlugin : IPlugin
    {
        private const int StatusCancelled = 100000002;
        private const int PaymentPaid = 100000001;
        private const int PaymentRefundDue = 100000003;

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            if (!context.InputParameters.Contains("Target") || !(context.InputParameters["Target"] is Entity target))
                return;
            if (target.LogicalName != "ye_booking")
                return;

            // Only act when the booking is being cancelled
            var status = target.GetAttributeValue<OptionSetValue>("ye_status");
            if (status == null || status.Value != StatusCancelled)
                return;

            // Paid bookings become Refund Due
            var preImage = context.PreEntityImages.Contains("PreImage") ? context.PreEntityImages["PreImage"] : null;
            var payment = target.Contains("ye_paymentstatus")
                ? target.GetAttributeValue<OptionSetValue>("ye_paymentstatus")
                : preImage?.GetAttributeValue<OptionSetValue>("ye_paymentstatus");
            if (payment != null && payment.Value == PaymentPaid)
                target["ye_paymentstatus"] = new OptionSetValue(PaymentRefundDue);
        }
    }
}
