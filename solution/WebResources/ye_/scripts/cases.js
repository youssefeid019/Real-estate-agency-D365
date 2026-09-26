(function () {
  "use strict";

  var Xrm = window.parent.Xrm || window.Xrm;
  var FORMATTED = "@OData.Community.Display.V1.FormattedValue";
  var FACILITY_AVAILABLE = 100000000;
  var CASE_SELECT = "?$select=incidentid,ticketnumber,title,_ye_facility_value,prioritycode,ye_takesoutofservice,statecode,statuscode,isescalated,_ownerid_value,createdon";
  var MAX_RESULTS = 25;

  // DOM and OData helpers
  function $(id) { return document.getElementById(id); }
  function text(v) { return v == null ? "" : String(v); }
  function literal(s) { return "'" + encodeURIComponent(s.replace(/'/g, "''")) + "'"; }

  // Fill a counter tile
  async function showCount(id, entity, filter) {
    try {
      var r = await Xrm.WebApi.retrieveMultipleRecords(entity, "?$select=" + entity + "id&$filter=" + filter, 5000);
      $(id).textContent = r.entities.length + (r.nextLink ? "+" : "");
    } catch (e) { $(id).textContent = "?"; $(id).title = e.message || String(e); }
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
    var id = name ? await viewId(entity, name) : null;
    var page = { pageType: "entitylist", entityName: entity };
    if (id) { page.viewId = id; page.viewType = "savedquery"; }
    return Xrm.Navigation.navigateTo(page);
  }

  var facilities = [];
  // Fill the facility list, marking closed ones
  async function loadFacilities() {
    var select = $("facility");
    try {
      var r = await Xrm.WebApi.retrieveMultipleRecords("ye_facility",
        "?$select=ye_facilityid,ye_name,ye_availabilitystatus&$filter=statecode eq 0&$orderby=ye_name");
      facilities = r.entities;
      select.innerHTML = '<option value="">Choose a facility</option>';
      facilities.forEach(function (f) {
        var o = document.createElement("option");
        o.value = f.ye_facilityid;
        o.textContent = f.ye_name + (f.ye_availabilitystatus !== FACILITY_AVAILABLE ? " (already out of service)" : "");
        select.appendChild(o);
      });
    } catch (e) {
      select.innerHTML = '<option value="">Couldn\'t load facilities</option>';
      $("flagError").textContent = e.message || String(e);
    }
  }

  // Open a pre-filled case form for the chosen facility
  function flagCase(event) {
    event.preventDefault();
    var facilityId = $("facility").value;
    var title = $("title").value.trim();
    $("flagError").textContent = !facilityId ? "Choose the facility." : !title ? "Say what's wrong." : "";
    if (!facilityId) { $("facility").focus(); return; }
    if (!title) { $("title").focus(); return; }
    var facility = facilities.filter(function (f) { return f.ye_facilityid === facilityId; })[0];
    var params = {
      title: title,
      ye_facility: facilityId,
      ye_facilityname: facility ? facility.ye_name : "",
      ye_facilitytype: "ye_facility",
      prioritycode: Number($("priority").value),
    };
    if ($("outOfService").checked) params.ye_takesoutofservice = true;
    Xrm.Navigation.openForm({ entityName: "incident" }, params);
  }

  // Status badge for a case
  function statusPill(c) {
    var pill = document.createElement("span");
    pill.className = "pill" + (c.statecode !== 0 ? " muted" : c.isescalated ? " high" : "");
    pill.textContent = c.statecode === 0 && c.isescalated ? "Escalated" : text(c["statuscode" + FORMATTED] || (c.statecode === 0 ? "Active" : "Closed"));
    return pill;
  }

  // Render the cases table
  function render(cases, emptyMessage) {
    var body = $("cases");
    body.innerHTML = "";
    if (!cases.length) {
      body.innerHTML = '<tr><td colspan="8" class="empty"></td></tr>';
      body.querySelector("td").textContent = emptyMessage;
      return;
    }
    cases.forEach(function (c) {
      var tr = document.createElement("tr");
      var cells = [
        c.ticketnumber,
        c.title,
        c["_ye_facility_value" + FORMATTED],
        null,
        c.ye_takesoutofservice ? "Yes" : "No",
        null,
        c["_ownerid_value" + FORMATTED],
        new Date(c.createdon).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
      ];
      cells.forEach(function (v, i) {
        var td = document.createElement("td");
        if (i === 3) {
          var p = document.createElement("span");
          p.className = "pill" + (c.prioritycode === 1 ? " high" : " muted");
          p.textContent = text(c["prioritycode" + FORMATTED] || "—");
          td.appendChild(p);
        } else if (i === 4 && c.ye_takesoutofservice) {
          var closed = document.createElement("span");
          closed.className = "pill closed";
          closed.textContent = "Yes";
          td.appendChild(closed);
        } else if (i === 5) td.appendChild(statusPill(c));
        else td.textContent = text(v);
        if (i === 1) td.title = text(v);
        tr.appendChild(td);
      });
      tr.tabIndex = 0;
      var open = function () { Xrm.Navigation.openForm({ entityName: "incident", entityId: c.incidentid }); };
      tr.addEventListener("click", open);
      tr.addEventListener("keydown", function (e) { if (e.key === "Enter") open(); });
      $("cases").appendChild(tr);
    });
  }

  // Show a load error
  function showError(e) {
    var body = $("cases");
    body.innerHTML = '<tr><td colspan="8" class="empty error"></td></tr>';
    body.querySelector("td").textContent = "Couldn't load cases: " + (e.message || e);
  }

  // Latest open cases
  async function latest() {
    $("resultsTitle").textContent = "Latest open cases";
    $("clearSearch").hidden = true;
    try {
      var r = await Xrm.WebApi.retrieveMultipleRecords("incident",
        CASE_SELECT + "&$filter=statecode eq 0 and _ye_facility_value ne null&$orderby=createdon desc", 10);
      render(r.entities, "No open maintenance cases. Flag one above when something needs fixing.");
    } catch (e) { showError(e); }
  }

  // Search cases by number, title or facility
  async function search(term) {
    $("resultsTitle").textContent = "Cases matching “" + term + "”";
    $("clearSearch").hidden = false;
    $("cases").innerHTML = '<tr><td colspan="8" class="empty">Searching…</td></tr>';
    try {
      var matches = ["contains(ticketnumber," + literal(term) + ")", "contains(title," + literal(term) + ")"];
      var f = await Xrm.WebApi.retrieveMultipleRecords("ye_facility",
        "?$select=ye_facilityid&$filter=contains(ye_name," + literal(term) + ")", 20);
      f.entities.forEach(function (x) { matches.push("_ye_facility_value eq " + x.ye_facilityid); });
      var filter = "_ye_facility_value ne null and (" + matches.join(" or ") + ")";
      if (!$("includeClosed").checked) filter = "statecode eq 0 and " + filter;
      var r = await Xrm.WebApi.retrieveMultipleRecords("incident", CASE_SELECT + "&$filter=" + filter + "&$orderby=createdon desc", MAX_RESULTS);
      render(r.entities, $("includeClosed").checked
        ? "No maintenance case matches. Check the case number, or search by facility."
        : "No open case matches. Tick “Include resolved and cancelled cases” to search closed ones too.");
    } catch (e) { showError(e); }
  }

  // Search form handler
  function runSearch(event) {
    if (event) event.preventDefault();
    var term = $("search").value.trim();
    if (term) search(term); else latest();
  }

  // Reload counters, facilities and cases
  function refresh() {
    showCount("nOpen", "incident", "statecode eq 0 and _ye_facility_value ne null");
    showCount("nOutOfService", "incident", "statecode eq 0 and _ye_facility_value ne null and ye_takesoutofservice eq true");
    showCount("nEscalated", "incident", "statecode eq 0 and _ye_facility_value ne null and isescalated eq true");
    showCount("nAffected", "ye_booking", "statecode eq 0 and _ye_maintenancecase_value ne null and ye_status ne 100000002 and ye_status ne 100000003");
  }

  // Form, button and tile handlers
  $("flagForm").addEventListener("submit", flagCase);
  $("searchForm").addEventListener("submit", runSearch);
  $("includeClosed").addEventListener("change", function () { if ($("search").value.trim()) runSearch(); });
  $("clearSearch").addEventListener("click", function () { $("search").value = ""; latest(); });
  $("openQueue").addEventListener("click", function () { openView("queueitem"); });
  $("openAll").addEventListener("click", function () { openView("incident", "Open Maintenance Cases"); });
  document.querySelectorAll("[data-view]").forEach(function (b) {
    var parts = b.getAttribute("data-view").split("|");
    b.addEventListener("click", function () { openView(parts[0], parts[1]); });
  });

  loadFacilities();
  refresh();
  latest();
  // Refresh when the page is shown again
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) { refresh(); if (!$("search").value.trim()) latest(); }
  });
})();
