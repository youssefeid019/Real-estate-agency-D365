var YE = window.YE || {};

// Booking form: maintenance warning and price estimate
YE.BookingForm = (function () {
  "use strict";

  var FACILITY_UNDER_MAINTENANCE = 100000001;
  var STATUS_CANCELLED = 100000002;
  var FORMATTED = "@OData.Community.Display.V1.FormattedValue";
  var NOTE_MAINTENANCE = "ye_facility_maintenance";
  var NOTE_ESTIMATE = "ye_price_estimate";

  var facility = { id: null, name: "", rate: null, rateFormatted: "", underMaintenance: false };

  // Current value of a form field
  function value(form, field) {
    var a = form.getAttribute(field);
    return a ? a.getValue() : null;
  }

  // Format an amount like a sample currency string
  function formatLike(sample, amount) {
    var text = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return sample ? sample.replace(/\d[\d.,\s ]*\d|\d/, text) : text;
  }

  // Load the selected facility's rate and status
  async function loadFacility(form) {
    var lookup = value(form, "ye_facility");
    var id = lookup && lookup.length ? lookup[0].id.replace(/[{}]/g, "").toLowerCase() : null;
    if (id === facility.id) return;
    facility = { id: id, name: "", rate: null, rateFormatted: "", underMaintenance: false };
    if (!id) return;
    var f = await Xrm.WebApi.retrieveRecord("ye_facility", id, "?$select=ye_name,ye_hourlyrate,ye_availabilitystatus");
    facility = {
      id: id,
      name: f.ye_name,
      rate: f.ye_hourlyrate,
      rateFormatted: f["ye_hourlyrate" + FORMATTED] || "",
      underMaintenance: f.ye_availabilitystatus === FACILITY_UNDER_MAINTENANCE,
    };
  }

  // Warn when the facility is under maintenance
  function showMaintenance(form) {
    var cancelled = value(form, "ye_status") === STATUS_CANCELLED;
    if (facility.underMaintenance && !cancelled)
      form.ui.setFormNotification(
        facility.name + " is under maintenance: saving this booking will be rejected until its maintenance case is resolved.",
        "WARNING",
        NOTE_MAINTENANCE,
      );
    else form.ui.clearFormNotification(NOTE_MAINTENANCE);
  }

  // Show an estimated price until the plugin prices it
  function showEstimate(form) {
    var start = value(form, "ye_starttime");
    var end = value(form, "ye_endtime");
    var saved = form.ui.getFormType() !== 1 && !form.data.entity.getIsDirty();
    if (saved || !start || !end || end <= start || facility.rate == null || value(form, "ye_status") === STATUS_CANCELLED) {
      form.ui.clearFormNotification(NOTE_ESTIMATE);
      return;
    }
    var hours = (end.getTime() - start.getTime()) / 3600000;
    form.ui.setFormNotification(
      "Estimated price: " + formatLike(facility.rateFormatted, hours * facility.rate) + " (" + hours + " h × " + facility.rateFormatted +
        "). The final price, with any active membership discount, is calculated when you save.",
      "INFO",
      NOTE_ESTIMATE,
    );
  }

  // Refresh both notifications
  async function refresh(executionContext) {
    var form = executionContext.getFormContext();
    try {
      await loadFacility(form);
    } catch (e) {
      facility = { id: null, name: "", rate: null, rateFormatted: "", underMaintenance: false };
    }
    showMaintenance(form);
    showEstimate(form);
  }

  return {
    // Form OnLoad and field OnChange handlers
    onLoad: function (executionContext) {
      var form = executionContext.getFormContext();
      form.data.entity.addOnPostSave(function () {
        form.ui.clearFormNotification(NOTE_ESTIMATE);
      });
      return refresh(executionContext);
    },
    onChange: refresh,
  };
})();
