(function () {
  "use strict";

  var Xrm = window.parent.Xrm || window.Xrm;
  var FORMATTED = "@OData.Community.Display.V1.FormattedValue";
  var FACILITY_UNDER_MAINTENANCE = 100000001;
  var BOOKING_DRAFT = 100000000;

  // DOM helpers
  function $(id) { return document.getElementById(id); }

  function text(v) { return v == null ? "" : String(v); }

  // Count records matching a filter
  async function count(entity, filter) {
    var r = await Xrm.WebApi.retrieveMultipleRecords(entity, "?$select=" + entity + "id&$filter=" + filter, 5000);
    return r.entities.length + (r.nextLink ? "+" : "");
  }

  // Fill a counter tile
  async function showCount(id, entity, filter) {
    try { $(id).textContent = await count(entity, filter); }
    catch (e) { $(id).textContent = "?"; $(id).title = e.message || String(e); }
  }

  var viewIds = {};
  // Find a view by name
  async function viewId(entity, name) {
    var key = entity + "|" + name;
    if (key in viewIds) return viewIds[key];
    var r = await Xrm.WebApi.retrieveMultipleRecords("savedquery",
      "?$select=savedqueryid&$filter=returnedtypecode eq '" + entity + "' and name eq '" + name.replace(/'/g, "''") + "'", 1);
    return (viewIds[key] = r.entities.length ? r.entities[0].savedqueryid : null);
  }

  // Open a list view
  async function openView(entity, name) {
    var id = await viewId(entity, name);
    var page = { pageType: "entitylist", entityName: entity };
    if (id) { page.viewId = id; page.viewType = "savedquery"; }
    return Xrm.Navigation.navigateTo(page);
  }

  // List the latest open enquiries
  async function latestEnquiries() {
    var body = $("enquiries");
    try {
      var r = await Xrm.WebApi.retrieveMultipleRecords("lead",
        "?$select=fullname,companyname,_ye_facility_value,ye_groupsize,ye_sessions,leadsourcecode,_ownerid_value,createdon" +
        "&$filter=statecode eq 0 and _ye_facility_value ne null&$orderby=createdon desc", 6);
      if (!r.entities.length) {
        body.innerHTML = '<tr><td colspan="8" class="empty">No open group enquiries yet. Start one with <strong>+ New group enquiry</strong>.</td></tr>';
        return;
      }
      body.innerHTML = "";
      r.entities.forEach(function (l) {
        var tr = document.createElement("tr");
        var cells = [
          l.fullname,
          l.companyname,
          l["_ye_facility_value" + FORMATTED],
          l.ye_groupsize,
          l.ye_sessions,
          null,
          l["_ownerid_value" + FORMATTED],
          new Date(l.createdon).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        ];
        cells.forEach(function (c, i) {
          var td = document.createElement("td");
          if (i === 5) {
            var pill = document.createElement("span");
            pill.className = "pill";
            pill.textContent = text(l["leadsourcecode" + FORMATTED] || "—");
            td.appendChild(pill);
          } else td.textContent = text(c);
          tr.appendChild(td);
        });
        tr.tabIndex = 0;
        var open = function () { Xrm.Navigation.openForm({ entityName: "lead", entityId: l.leadid }); };
        tr.addEventListener("click", open);
        tr.addEventListener("keydown", function (e) { if (e.key === "Enter") open(); });
        body.appendChild(tr);
      });
    } catch (e) {
      body.innerHTML = '<tr><td colspan="8" class="empty error"></td></tr>';
      body.querySelector("td").textContent = "Couldn't load enquiries: " + (e.message || e);
    }
  }

  // Reload counters and enquiries
  function refresh() {
    showCount("nEnquiries", "lead", "statecode eq 0 and _ye_facility_value ne null");
    showCount("nDeals", "opportunity", "statecode eq 0 and _ye_facility_value ne null");
    showCount("nDrafts", "ye_booking", "statecode eq 0 and ye_status eq " + BOOKING_DRAFT);
    showCount("nClosed", "ye_facility", "statecode eq 0 and ye_availabilitystatus eq " + FACILITY_UNDER_MAINTENANCE);
    latestEnquiries();
  }

  // Button and tile handlers
  $("newEnquiry").addEventListener("click", function () { YE.Commands.newEnquiry(); });
  $("bookFacility").addEventListener("click", function () { YE.Commands.bookFacility(); });
  $("newCase").addEventListener("click", function () { YE.Commands.newMaintenanceCase(); });
  $("openEnquiries").addEventListener("click", function () { openView("lead", "Group Enquiries"); });
  $("openDeals").addEventListener("click", function () { openView("opportunity", "Open Block Bookings"); });
  document.querySelectorAll("[data-view]").forEach(function (b) {
    var parts = b.getAttribute("data-view").split("|");
    b.addEventListener("click", function () { openView(parts[0], parts[1]); });
  });

  refresh();
  // Refresh when the page is shown again
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
})();
