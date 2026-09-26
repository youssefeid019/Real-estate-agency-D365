using System;
using System.Linq;
using FakeXrmEasy;
using Microsoft.Xrm.Sdk;
using Xunit;

namespace YE.Plugins.Tests
{
    // Unit tests for the plugins using an in-memory Dataverse
    public class PluginTests
    {
        const int Draft = 100000000, Confirmed = 100000001, Cancelled = 100000002, Completed = 100000003;
        const int Available = 100000000, UnderMaintenance = 100000001;
        const int AwaitingPayment = 100000000, Paid = 100000001, RefundDue = 100000003;
        static readonly DateTime Start = new DateTime(2026, 11, 2, 10, 0, 0, DateTimeKind.Utc);

        readonly XrmFakedContext ctx = new XrmFakedContext();
        readonly Entity facility = new Entity("ye_facility", Guid.NewGuid())
        {
            ["ye_hourlyrate"] = new Money(100m),
            ["ye_availabilitystatus"] = new OptionSetValue(Available),
        };
        readonly Entity person = new Entity("contact", Guid.NewGuid());
        readonly Entity company = new Entity("account", Guid.NewGuid());

        // Test booking on the shared facility
        Entity Booking(DateTime start, double hours, int status = Confirmed, Guid? id = null) => new Entity("ye_booking", id ?? Guid.NewGuid())
        {
            ["ye_facility"] = facility.ToEntityReference(),
            ["ye_customer"] = person.ToEntityReference(),
            ["ye_starttime"] = start,
            ["ye_endtime"] = start.AddHours(hours),
            ["ye_status"] = new OptionSetValue(status),
        };

        // Runs a plugin in the pre-operation stage
        Entity Run<T>(string message, Entity target, Entity preImage = null) where T : IPlugin, new()
        {
            var plugin = ctx.GetDefaultPluginContext();
            plugin.MessageName = message;
            plugin.Stage = 20;
            plugin.InputParameters["Target"] = target;
            if (preImage != null) plugin.PreEntityImages["PreImage"] = preImage;
            ctx.ExecutePluginWith<T>(plugin);
            return target;
        }

        static decimal? Price(Entity e, string field = "ye_totalprice") => e.GetAttributeValue<Money>(field)?.Value;

        [Fact]
        // Overlap validation
        public void Overlap_rejects_a_booking_overlapping_another()
        {
            ctx.Initialize(new[] { facility, Booking(Start, 2) });
            var ex = Assert.Throws<InvalidPluginExecutionException>(() => Run<BookingOverlapValidationPlugin>("Create", Booking(Start.AddHours(1), 2)));
            Assert.Contains("already booked", ex.Message);
        }

        [Fact]
        public void Overlap_allows_back_to_back_and_ignores_cancelled_bookings()
        {
            ctx.Initialize(new[] { facility, Booking(Start, 2), Booking(Start.AddHours(2), 1, Cancelled) });
            Run<BookingOverlapValidationPlugin>("Create", Booking(Start.AddHours(2), 1));
        }

        [Fact]
        public void Overlap_does_not_conflict_with_itself_on_update()
        {
            var existing = Booking(Start, 2);
            ctx.Initialize(new[] { facility, existing });
            Run<BookingOverlapValidationPlugin>("Update", new Entity("ye_booking", existing.Id) { ["ye_endtime"] = Start.AddHours(3) }, existing);
        }

        [Fact]
        public void Overlap_rejects_end_before_start()
        {
            ctx.Initialize(new[] { facility });
            Assert.Throws<InvalidPluginExecutionException>(() => Run<BookingOverlapValidationPlugin>("Create", Booking(Start, -1)));
        }

        [Fact]
        public void Overlap_rejects_a_facility_under_maintenance()
        {
            facility["ye_availabilitystatus"] = new OptionSetValue(UnderMaintenance);
            ctx.Initialize(new[] { facility });
            var ex = Assert.Throws<InvalidPluginExecutionException>(() => Run<BookingOverlapValidationPlugin>("Create", Booking(Start, 1)));
            Assert.Contains("maintenance", ex.Message);
        }

        [Theory]
        [InlineData(Cancelled)]
        [InlineData(Completed)]
        public void Overlap_lets_a_booking_be_closed_on_a_facility_under_maintenance(int closedStatus)
        {
            facility["ye_availabilitystatus"] = new OptionSetValue(UnderMaintenance);
            var existing = Booking(Start, 1);
            ctx.Initialize(new[] { facility, existing });
            Run<BookingOverlapValidationPlugin>("Update", new Entity("ye_booking", existing.Id) { ["ye_status"] = new OptionSetValue(closedStatus) }, existing);
        }

        [Fact]
        // Booking pricing
        public void Pricing_is_hours_times_rate()
        {
            ctx.Initialize(new[] { facility });
            Assert.Equal(150m, Price(Run<BookingPricingPlugin>("Create", Booking(Start, 1.5))));
        }

        [Fact]
        public void Pricing_applies_an_active_membership_discount_to_a_person()
        {
            var membership = new Entity("ye_membership", Guid.NewGuid())
            {
                ["ye_member"] = person.ToEntityReference(),
                ["ye_status"] = new OptionSetValue(100000000),
                ["ye_discountpercentage"] = 20m,
            };
            ctx.Initialize(new[] { facility, person, membership });
            Assert.Equal(160m, Price(Run<BookingPricingPlugin>("Create", Booking(Start, 2))));
        }

        [Fact]
        public void Pricing_gives_no_membership_discount_to_an_organisation()
        {
            var membership = new Entity("ye_membership", Guid.NewGuid())
            {
                ["ye_member"] = company.ToEntityReference(),
                ["ye_status"] = new OptionSetValue(100000000),
                ["ye_discountpercentage"] = 20m,
            };
            ctx.Initialize(new[] { facility, company, membership });
            var booking = Booking(Start, 2);
            booking["ye_customer"] = company.ToEntityReference();
            Assert.Equal(200m, Price(Run<BookingPricingPlugin>("Create", booking)));
        }

        [Fact]
        public void Pricing_reprices_when_the_time_changes()
        {
            var existing = Booking(Start, 1);
            ctx.Initialize(new[] { facility, existing });
            var update = Run<BookingPricingPlugin>("Update", new Entity("ye_booking", existing.Id) { ["ye_endtime"] = Start.AddHours(3) }, existing);
            Assert.Equal(300m, Price(update));
        }

        [Theory]
        [InlineData(Completed)]
        [InlineData(Cancelled)]
        public void Pricing_freezes_the_price_when_a_booking_is_closed(int closedStatus)
        {
            var existing = Booking(Start, 1);
            facility["ye_hourlyrate"] = new Money(250m);
            ctx.Initialize(new[] { facility, existing });
            var update = Run<BookingPricingPlugin>("Update", new Entity("ye_booking", existing.Id) { ["ye_status"] = new OptionSetValue(closedStatus) }, existing);
            Assert.False(update.Contains("ye_totalprice"));
        }

        [Fact]
        // Payment status
        public void Payment_cancelling_a_paid_booking_makes_it_refund_due()
        {
            var existing = Booking(Start, 1);
            existing["ye_paymentstatus"] = new OptionSetValue(Paid);
            ctx.Initialize(new[] { existing });
            var update = Run<BookingPaymentPlugin>("Update", new Entity("ye_booking", existing.Id) { ["ye_status"] = new OptionSetValue(Cancelled) }, existing);
            Assert.Equal(RefundDue, update.GetAttributeValue<OptionSetValue>("ye_paymentstatus").Value);
        }

        [Fact]
        public void Payment_cancelling_an_unpaid_booking_leaves_the_payment_status()
        {
            var existing = Booking(Start, 1);
            existing["ye_paymentstatus"] = new OptionSetValue(AwaitingPayment);
            ctx.Initialize(new[] { existing });
            var update = Run<BookingPaymentPlugin>("Update", new Entity("ye_booking", existing.Id) { ["ye_status"] = new OptionSetValue(Cancelled) }, existing);
            Assert.False(update.Contains("ye_paymentstatus"));
        }

        [Fact]
        public void Payment_completing_a_paid_booking_leaves_it_paid()
        {
            var existing = Booking(Start, 1);
            existing["ye_paymentstatus"] = new OptionSetValue(Paid);
            ctx.Initialize(new[] { existing });
            var update = Run<BookingPaymentPlugin>("Update", new Entity("ye_booking", existing.Id) { ["ye_status"] = new OptionSetValue(Completed) }, existing);
            Assert.False(update.Contains("ye_paymentstatus"));
        }

        // Opportunity pricing
        Entity Deal(int? sessions, decimal? hours) => new Entity("opportunity", Guid.NewGuid())
        {
            ["ye_facility"] = facility.ToEntityReference(),
            ["ye_sessions"] = sessions,
            ["ye_sessionhours"] = hours,
        };

        [Fact]
        public void OpportunityPricing_sets_the_list_price_and_prefills_the_proposal()
        {
            ctx.Initialize(new[] { facility });
            var deal = Run<OpportunityPricingPlugin>("Create", Deal(3, 1.5m));
            Assert.Equal(450m, Price(deal, "ye_listprice"));
            Assert.Equal(450m, Price(deal, "estimatedvalue"));
        }

        [Fact]
        public void OpportunityPricing_proposal_follows_the_list_price_until_negotiated()
        {
            var existing = Deal(3, 1.5m);
            existing["ye_listprice"] = new Money(450m);
            existing["estimatedvalue"] = new Money(450m);
            ctx.Initialize(new[] { facility, existing });
            var update = Run<OpportunityPricingPlugin>("Update", new Entity("opportunity", existing.Id) { ["ye_sessions"] = 4 }, existing);
            Assert.Equal(600m, Price(update, "ye_listprice"));
            Assert.Equal(600m, Price(update, "estimatedvalue"));
        }

        [Fact]
        public void OpportunityPricing_keeps_a_negotiated_proposal()
        {
            var existing = Deal(3, 1.5m);
            existing["ye_listprice"] = new Money(450m);
            existing["estimatedvalue"] = new Money(400m);
            ctx.Initialize(new[] { facility, existing });
            var update = Run<OpportunityPricingPlugin>("Update", new Entity("opportunity", existing.Id) { ["ye_sessions"] = 4 }, existing);
            Assert.Equal(600m, Price(update, "ye_listprice"));
            Assert.False(update.Contains("estimatedvalue"));
        }

        [Fact]
        public void OpportunityPricing_ignores_a_deal_without_sessions()
        {
            ctx.Initialize(new[] { facility });
            var deal = Run<OpportunityPricingPlugin>("Create", Deal(null, 1.5m));
            Assert.False(deal.Contains("ye_listprice"));
        }

        // Block booking generation
        Entity WonDeal(int sessions, int? frequency, DateTime? first, decimal? hours = 1.5m, bool corporate = false)
        {
            var deal = new Entity("opportunity", Guid.NewGuid())
            {
                ["ye_facility"] = facility.ToEntityReference(),
                ["parentcontactid"] = person.ToEntityReference(),
                ["ye_sessions"] = sessions,
                ["ye_sessionhours"] = hours,
                ["ye_firstsession"] = first,
            };
            if (frequency != null) deal["ye_frequency"] = new OptionSetValue(frequency.Value);
            if (corporate) deal["parentaccountid"] = company.ToEntityReference();
            return deal;
        }

        Entity[] BookingsOf(Entity deal) => ctx.CreateQuery("ye_booking")
            .Where(b => b.GetAttributeValue<EntityReference>("ye_opportunity") != null && b.GetAttributeValue<EntityReference>("ye_opportunity").Id == deal.Id)
            .ToArray()
            .OrderBy(b => b.GetAttributeValue<DateTime?>("ye_starttime") ?? DateTime.MaxValue)
            .ToArray();

        [Theory]
        [InlineData(100000000, 7)]
        [InlineData(100000001, 14)]
        [InlineData(100000002, 1)]
        public void BlockBookings_one_timed_draft_per_session(int frequency, int stepDays)
        {
            var deal = WonDeal(3, frequency, Start);
            ctx.Initialize(new[] { facility, person, deal });
            var result = CreateBlockBookingsApi.Run(ctx.GetOrganizationService(), deal.Id, null);

            Assert.Equal(3, result.Created);
            Assert.Equal(0, result.Unscheduled);
            var bookings = BookingsOf(deal);
            Assert.Equal(3, bookings.Length);
            for (int i = 0; i < 3; i++)
            {
                Assert.Equal(Draft, bookings[i].GetAttributeValue<OptionSetValue>("ye_status").Value);
                Assert.Equal(Start.AddDays(i * stepDays), bookings[i].GetAttributeValue<DateTime>("ye_starttime"));
                Assert.Equal(Start.AddDays(i * stepDays).AddHours(1.5), bookings[i].GetAttributeValue<DateTime>("ye_endtime"));
                Assert.Equal(person.Id, bookings[i].GetAttributeValue<EntityReference>("ye_customer").Id);
            }
        }

        [Fact]
        public void BlockBookings_a_taken_slot_becomes_an_untimed_draft_with_a_note()
        {
            var deal = WonDeal(3, 100000000, Start);
            ctx.Initialize(new[] { facility, person, deal, Booking(Start.AddDays(7), 1) });
            var result = CreateBlockBookingsApi.Run(ctx.GetOrganizationService(), deal.Id, null);

            Assert.Equal(2, result.Created);
            Assert.Equal(1, result.Unscheduled);
            var untimed = BookingsOf(deal).Single(b => !b.Contains("ye_starttime"));
            Assert.Contains("Session 2 of 3", untimed.GetAttributeValue<string>("ye_schedulingnote"));
            Assert.Contains("already booked", untimed.GetAttributeValue<string>("ye_schedulingnote"));
        }

        [Fact]
        public void BlockBookings_daily_sessions_longer_than_a_day_do_not_overlap_each_other()
        {
            var deal = WonDeal(2, 100000002, Start, hours: 30m);
            ctx.Initialize(new[] { facility, person, deal });
            var result = CreateBlockBookingsApi.Run(ctx.GetOrganizationService(), deal.Id, null);
            Assert.Equal(1, result.Created);
            Assert.Equal(1, result.Unscheduled);
        }

        [Fact]
        public void BlockBookings_a_facility_under_maintenance_gives_untimed_drafts()
        {
            facility["ye_availabilitystatus"] = new OptionSetValue(UnderMaintenance);
            var deal = WonDeal(2, 100000000, Start);
            ctx.Initialize(new[] { facility, person, deal });
            var result = CreateBlockBookingsApi.Run(ctx.GetOrganizationService(), deal.Id, null);
            Assert.Equal(0, result.Created);
            Assert.Equal(2, result.Unscheduled);
            Assert.All(BookingsOf(deal), b => Assert.Contains("maintenance", b.GetAttributeValue<string>("ye_schedulingnote")));
        }

        [Fact]
        public void BlockBookings_without_a_schedule_creates_one_untimed_draft()
        {
            var deal = WonDeal(5, null, null);
            ctx.Initialize(new[] { facility, person, deal });
            var result = CreateBlockBookingsApi.Run(ctx.GetOrganizationService(), deal.Id, null);
            Assert.Equal(1, result.Unscheduled);
            Assert.Single(BookingsOf(deal));
        }

        [Fact]
        public void BlockBookings_a_corporate_deal_books_the_account()
        {
            var deal = WonDeal(1, 100000000, Start, corporate: true);
            ctx.Initialize(new[] { facility, person, company, deal });
            CreateBlockBookingsApi.Run(ctx.GetOrganizationService(), deal.Id, null);
            var member = BookingsOf(deal).Single().GetAttributeValue<EntityReference>("ye_customer");
            Assert.Equal("account", member.LogicalName);
            Assert.Equal(company.Id, member.Id);
        }

        [Fact]
        public void BlockBookings_is_idempotent_for_a_re_won_deal()
        {
            var deal = WonDeal(3, 100000000, Start);
            ctx.Initialize(new[] { facility, person, deal });
            CreateBlockBookingsApi.Run(ctx.GetOrganizationService(), deal.Id, null);
            var second = CreateBlockBookingsApi.Run(ctx.GetOrganizationService(), deal.Id, null);
            Assert.Equal(0, second.Created + second.Unscheduled);
            Assert.Equal(3, BookingsOf(deal).Length);
        }
    }
}
