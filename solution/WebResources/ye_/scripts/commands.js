var YE = window.YE || {};

// Command bar and home page actions
YE.Commands = (function () {
  "use strict";

  var FACILITY_UNDER_MAINTENANCE = 100000001;
  var FORMATTED = "@OData.Community.Display.V1.FormattedValue";

  // The app's Xrm, also from inside a frame
  function xrm() {
    return window.Xrm || (window.parent && window.parent.Xrm);
  }

  function cleanId(id) {
    return (id || "").replace(/[{}]/g, "").toLowerCase();
  }

  // Add lookup form parameters
  function setLookup(params, field, entityType, id, name) {
    if (!id) return;
    params[field] = cleanId(id);
    params[field + "name"] = name || "";
    params[field + "type"] = entityType;
  }

  async function prefillFrom(input) {
    var X = xrm();
    var params = {};
    if (!input || input.pageType !== "entityrecord" || !input.entityId) return params;
    var id = cleanId(input.entityId);

    if (input.entityName === "ye_facility") {
      var f = await X.WebApi.retrieveRecord("ye_facility", id, "?$select=ye_name,ye_availabilitystatus");
      if (f.ye_availabilitystatus === FACILITY_UNDER_MAINTENANCE) {
        var go = await X.Navigation.openConfirmDialog({
          title: "Facility under maintenance",
          text: f.ye_name + " is closed for bookings until its maintenance case is resolved. A booking for it will be rejected when you save. Open a new booking anyway?",
          confirmButtonLabel: "Open booking",
          cancelButtonLabel: "Cancel",
        });
        if (!go.confirmed) return null;
      }
      setLookup(params, "ye_facility", "ye_facility", id, f.ye_name);
    } else if (input.entityName === "contact") {
      var c = await X.WebApi.retrieveRecord("contact", id, "?$select=fullname");
      setLookup(params, "ye_customer", "contact", id, c.fullname);
    } else if (input.entityName === "account") {
      var a = await X.WebApi.retrieveRecord("account", id, "?$select=name");
      setLookup(params, "ye_customer", "account", id, a.name);
    } else if (input.entityName === "opportunity") {
      var o = await X.WebApi.retrieveRecord("opportunity", id, "?$select=name,_ye_facility_value,_parentaccountid_value,_parentcontactid_value");
      setLookup(params, "ye_opportunity", "opportunity", id, o.name);
      setLookup(params, "ye_facility", "ye_facility", o._ye_facility_value, o["_ye_facility_value" + FORMATTED]);
      if (o._parentaccountid_value) setLookup(params, "ye_customer", "account", o._parentaccountid_value, o["_parentaccountid_value" + FORMATTED]);
      else setLookup(params, "ye_customer", "contact", o._parentcontactid_value, o["_parentcontactid_value" + FORMATTED]);
    }
    return params;
  }

  // Open a new booking pre-filled from the current record
  async function bookFacility() {
    var X = xrm();
    try {
      var page = X.Utility.getPageContext ? X.Utility.getPageContext() : null;
      var params = await prefillFrom(page && page.input);
      if (params === null) return;
      await X.Navigation.openForm({ entityName: "ye_booking", openInNewWindow: false }, params);
    } catch (e) {
      X.Navigation.openErrorDialog({ message: "Couldn't open a new booking: " + (e && e.message ? e.message : e) });
    }
  }

  // Open a new group enquiry
  function newEnquiry() {
    return xrm().Navigation.openForm({ entityName: "lead" }, { subject: "Group booking enquiry: " });
  }

  // Open a new maintenance case
  function newMaintenanceCase() {
    return xrm().Navigation.openForm({ entityName: "incident" });
  }

  return { bookFacility: bookFacility, newEnquiry: newEnquiry, newMaintenanceCase: newMaintenanceCase };
})();
