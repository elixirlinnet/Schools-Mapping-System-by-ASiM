var map = L.map("map", {
  zoomControl: false
}).setView([32.11, 72.12], 9);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

L.control.zoom({
  position: "bottomleft"
}).addTo(map);

var orderedMarkaz = [];
var schools = [];
var markers = [];
var schoolMarkers = new Map();
var markazColors = {};
var tehsilColors = {};

var FILTER_LABELS = {
  tehsilFilterBox: "Tehsil",
  markazFilterBox: "Markaz",
  genderFilterBox: "Gender",
  levelFilterBox: "Level",
  categoryFilterBox: "Category"
};

var longPressTimer = null;
var longPressStart = null;
var longPressDelay = 650;
var longPressMoveTolerance = 12;
var mapContainer = map.getContainer();

map.on("contextmenu", function(e){
  showCoordinatePopup(e.latlng);
});

L.DomEvent.on(mapContainer, "touchstart", handleMapTouchStart);
L.DomEvent.on(mapContainer, "touchmove", handleMapTouchMove);
L.DomEvent.on(mapContainer, "touchend touchcancel", clearLongPressTimer);
map.on("dragstart zoomstart", clearLongPressTimer);

function handleMapTouchStart(e){
  if(!e.touches || e.touches.length !== 1){
    clearLongPressTimer();
    return;
  }

  var touch = e.touches[0];
  longPressStart = {
    x: touch.clientX,
    y: touch.clientY,
    latlng: getTouchLatLng(touch)
  };

  clearLongPressTimer({ keepStart: true });
  longPressTimer = setTimeout(function(){
    if(longPressStart){
      showCoordinatePopup(longPressStart.latlng);
    }

    clearLongPressTimer();
  }, longPressDelay);
}

function handleMapTouchMove(e){
  if(!longPressStart || !e.touches || e.touches.length !== 1){
    clearLongPressTimer();
    return;
  }

  var touch = e.touches[0];
  var moveX = Math.abs(touch.clientX - longPressStart.x);
  var moveY = Math.abs(touch.clientY - longPressStart.y);

  if(moveX > longPressMoveTolerance || moveY > longPressMoveTolerance){
    clearLongPressTimer();
  }
}

function getTouchLatLng(touch){
  var rect = mapContainer.getBoundingClientRect();
  var point = L.point(touch.clientX - rect.left, touch.clientY - rect.top);

  return map.containerPointToLatLng(point);
}

function clearLongPressTimer(options){
  options = options || {};

  if(longPressTimer){
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  if(!options.keepStart){
    longPressStart = null;
  }
}

function showCoordinatePopup(latlng){
  var lat = latlng.lat.toFixed(6);
  var lng = latlng.lng.toFixed(6);

  var popupContent = `
    <b>Coordinates</b><br>
    Lat: ${lat}<br>
    Lng: ${lng}<br><br>
    <div class="popup-actions">
      <button onclick="copyCoords('${lat},${lng}')">Copy</button>
      <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank">
        <button>Open in Google Maps</button>
      </a>
    </div>
  `;

  L.popup()
    .setLatLng(latlng)
    .setContent(popupContent)
    .openOn(map);
}

loadSchools();

function loadSchools(){
  fetch("schools.csv")
    .then(response => {
      if(!response.ok) throw new Error("HTTP " + response.status);
      return response.text();
    })
    .then(loadSchoolsFromCsv)
    .catch(error => {
      if(window.SCHOOLS_CSV){
        loadSchoolsFromCsv(window.SCHOOLS_CSV);
        return;
      }

      document.getElementById("statsBox").innerHTML =
        "Unable to load schools.csv: " + error.message;
    });
}

function loadSchoolsFromCsv(data){
  var rows = parseCsv(data);

  schools = [];

  rows.slice(1).forEach(row => {
    var c = row.map(value => value.trim());

    if(c.length >= 8){
      var lat = parseFloat(c[6]);
      var lng = parseFloat(c[7]);

      if(!isNaN(lat) && !isNaN(lng)){
        schools.push({
          tehsil: c[0],
          markaz: c[1],
          name: c[2],
          gender: c[3],
          level: c[4],
          category: c[5],
          lat: lat,
          lng: lng
        });
      }
    }
  });

  orderedMarkaz = [...new Set(schools.map(s => s.markaz))].sort();
  populateFilters();
  updateMarkazFilter();
  showSchools();
}

function populateFilters(){
  var sets = {
    tehsilFilterBox: new Set(),
    markazFilterBox: new Set(),
    genderFilterBox: new Set(),
    levelFilterBox: new Set(),
    categoryFilterBox: new Set()
  };

  schools.forEach(s => {
    sets.tehsilFilterBox.add(s.tehsil);
    sets.markazFilterBox.add(s.markaz);
    sets.genderFilterBox.add(s.gender);
    sets.levelFilterBox.add(s.level);
    sets.categoryFilterBox.add(s.category);
  });

  Object.keys(sets).forEach(id => {
    var container = document.getElementById(id);

    addFilterButtons(container, function(action){
      if(id === "tehsilFilterBox"){
        updateMarkazFilter({
          selectAllVisible: action === "selectAll"
        });
      }

      showSchools();
    });

    [...sets[id]].sort().forEach(val => {
      addCheckbox(container, val, true, function(){
        if(id === "tehsilFilterBox"){
          updateMarkazFilter({
            addedTehsil: this.checked ? this.value : null
          });
        }

        showSchools();
      });
    });
  });
}

function addFilterButtons(container, onChange){
  var btnAll = document.createElement("button");
  btnAll.textContent = "Select All";
  btnAll.onclick = function(){
    container.querySelectorAll("input").forEach(cb => cb.checked = true);
    onChange("selectAll");
  };

  var btnNone = document.createElement("button");
  btnNone.textContent = "Clear All";
  btnNone.onclick = function(){
    container.querySelectorAll("input").forEach(cb => cb.checked = false);
    onChange("clearAll");
  };

  container.appendChild(btnAll);
  container.appendChild(btnNone);
}

function addCheckbox(container, value, checked, onChange){
  var label = document.createElement("label");
  var cb = document.createElement("input");

  cb.type = "checkbox";
  cb.value = value;
  cb.dataset.label = value;
  cb.checked = checked;
  cb.onchange = onChange;

  label.appendChild(cb);
  label.appendChild(document.createTextNode(" "));
  label.appendChild(createFilterLabelText(value));
  container.appendChild(label);
}

function getSelected(id){
  return [...document.querySelectorAll("#" + id + " input:checked")]
    .map(x => x.value);
}

function createFilterLabelText(value){
  var span = document.createElement("span");
  span.className = "filter-label-text";
  span.textContent = value;
  return span;
}

function updateMarkazFilter(options){
  options = options || {};

  var selectedTehsils = getSelected("tehsilFilterBox");
  var selectedMarkaz = new Set(getSelected("markazFilterBox"));
  var markazContainer = document.getElementById("markazFilterBox");

  markazContainer.innerHTML = "";

  addFilterButtons(markazContainer, function(){
    syncTehsilWithMarkaz();
    showSchools();
  });

  var filteredMarkaz = new Set();

  schools.forEach(s => {
    if(selectedTehsils.includes(s.tehsil)){
      filteredMarkaz.add(s.markaz);
    }
  });

  [...filteredMarkaz].sort().forEach(val => {
    var belongsToAddedTehsil = options.addedTehsil && schools.some(function(s){
      return s.tehsil === options.addedTehsil && s.markaz === val;
    });
    var shouldKeepSelection =
      options.selectAllVisible ||
      selectedMarkaz.size === 0 ||
      selectedMarkaz.has(val) ||
      belongsToAddedTehsil;

    addCheckbox(markazContainer, val, shouldKeepSelection, function(){
      syncTehsilWithMarkaz();
      showSchools();
    });
  });
}

function syncTehsilWithMarkaz(){
  var selectedMarkaz = getSelected("markazFilterBox");
  var tehsilCheckboxes = document.querySelectorAll("#tehsilFilterBox input");

  tehsilCheckboxes.forEach(function(cb){
    var tehsil = cb.value;

    cb.checked = schools.some(function(s){
      return s.tehsil === tehsil && selectedMarkaz.includes(s.markaz);
    });
  });
}

function getColor(markaz, tehsil){
  var selectedTehsils = getSelected("tehsilFilterBox");

  if(selectedTehsils.length > 1){
    return getTehsilColor(tehsil);
  }

  if(!markazColors[markaz]){
    var index = orderedMarkaz.indexOf(markaz);
    var hue = (index * 137) % 360;
    markazColors[markaz] = `hsl(${hue}, 70%, 45%)`;
  }

  return markazColors[markaz];
}

function getTehsilColor(tehsil){
  if(!tehsilColors[tehsil]){
    var hue = 0;

    if(tehsil === "KHUSHAB") hue = 220;
    else if(tehsil === "NOORPUR THAL") hue = 120;
    else if(tehsil === "QUAIDABAD") hue = 25;
    else if(tehsil === "NAUSHEHRA") hue = 285;

    tehsilColors[tehsil] = `hsl(${hue}, 65%, 45%)`;
  }

  return tehsilColors[tehsil];
}

function showSchools(){
  clearMarkers();
  markazColors = {};
  tehsilColors = {};

  var searchQuery = getSearchQuery();
  var searchActive = searchQuery.length > 0;
  var selectedTehsils = getSelected("tehsilFilterBox");
  var selectedLevels = getSelected("levelFilterBox");
  var selectedGenders = getSelected("genderFilterBox");
  var selectedCategories = getSelected("categoryFilterBox");
  var selectedMarkaz = getSelected("markazFilterBox");

  var bounds = [];
  var stats = createEmptyStats();
  var visibleSchools = [];
  schools.forEach(s => {
    if(
      matchesSearch(s, searchQuery) &&
      selectedTehsils.includes(s.tehsil) &&
      selectedLevels.includes(s.level) &&
      selectedGenders.includes(s.gender) &&
      selectedCategories.includes(s.category) &&
      selectedMarkaz.includes(s.markaz)
    ){
      addSchoolMarker(s, bounds, searchActive);
      updateSchoolStats(stats, s);
    }
  });

  if(bounds.length > 1) map.fitBounds(L.latLngBounds(bounds).pad(0.08), {
    maxZoom: 14
  });
  else if(bounds.length === 1) map.setView(bounds[0], 14);

  updateStats(stats);
  updateFilterSummary(stats, searchQuery);
  updateFilterCounts(searchQuery);
  updateFilterButtonLabels();
  updateLabels();
  updateLegend();
}

function clearMarkers(){
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  schoolMarkers.clear();
}

function createEmptyStats(){
  return {
    total: 0,
    gender: {},
    level: {},
    category: {},
    tehsil: {},
    markaz: {}
  };
}

function updateSchoolStats(stats, s){
  stats.total++;

  stats.gender[s.gender] = (stats.gender[s.gender] || 0) + 1;
  stats.level[s.level] = (stats.level[s.level] || 0) + 1;
  stats.category[s.category] = (stats.category[s.category] || 0) + 1;
  stats.tehsil[s.tehsil] = (stats.tehsil[s.tehsil] || 0) + 1;
  stats.markaz[s.markaz] = (stats.markaz[s.markaz] || 0) + 1;
}

function addSchoolMarker(s, bounds, highlight){
  var color = getColor(s.markaz, s.tehsil);
  var marker;

  if(s.category !== "SED"){
    marker = L.marker([s.lat, s.lng], {
      icon: L.divIcon({
        className: "",
        html: `
          <div class="${highlight ? "searched-marker" : ""}" style="
            width:${highlight ? 24 : 16}px;
            height:${highlight ? 24 : 16}px;
            background:${color};
            border:${highlight ? 3 : 0.1}px solid ${highlight ? "#ffc107" : "black"};
            transform:rotate(45deg);
          "></div>
        `,
        iconSize: [highlight ? 24 : 16, highlight ? 24 : 16]
      })
    });
  }
  else if(s.level === "Middle"){
    marker = L.circleMarker([s.lat, s.lng], {
      radius: highlight ? 15 : 10,
      fillColor: color,
      color: highlight ? "#ffc107" : "#000",
      weight: highlight ? 5 : 3,
      fillOpacity: 0.9
    });
  }
  else{
    marker = L.circleMarker([s.lat, s.lng], {
      radius: highlight ? 15 : 10,
      fillColor: color,
      color: highlight ? "#ffc107" : "#000",
      weight: highlight ? 5 : 0.5,
      fillOpacity: 0.9
    });
  }

  marker.school = s;
  marker
    .addTo(map)
    .bindPopup(getPopupContent(s))
    .bindTooltip(escapeHtml(s.name), { permanent: false });

  markers.push(marker);
  bounds.push([s.lat, s.lng]);
}

function escapeHtml(value){
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPopupContent(s){
  return (
    "<b>" + escapeHtml(s.name) + "</b><br>" +
    "Tehsil: " + escapeHtml(s.tehsil) + "<br>" +
    "Markaz: " + escapeHtml(s.markaz) + "<br>" +
    "Level: " + escapeHtml(s.level) + "<br>" +
    "Gender: " + escapeHtml(s.gender) + "<br>" +
    "Category: " + escapeHtml(s.category) + "<br>" +
    "Lat: " + s.lat + "<br>" +
    "Lng: " + s.lng + "<br><br>" +
    "<div class='popup-actions'>" +
    "<button onclick=\"copyCoords('" + s.lat + "," + s.lng + "')\">Copy</button>" +
    "<a href='https://www.google.com/maps/dir/?api=1&destination=" +
    s.lat + "," + s.lng +
    "' target='_blank'>" +
    "<button>Open in Google Maps</button></a>" +
    "</div>"
  );
}

function updateLegend(){
  var legend = document.getElementById("legend");
  var selectedTehsils = getSelected("tehsilFilterBox");
  var showTehsilLegend = selectedTehsils.length > 1;
  var visibleTehsils = {};
  var visibleMarkaz = {};

  markers.forEach(function(marker){
    if(marker.school){
      visibleTehsils[marker.school.tehsil] = true;
      visibleMarkaz[marker.school.markaz] = true;
    }
  });

  var html = `<div class="legend-section"><b>${showTehsilLegend ? "Tehsil" : "Markaz"}</b><br>`;

  if(showTehsilLegend){
    var sortedTehsils = getFilterOrder("tehsilFilterBox")
      .filter(tehsil => visibleTehsils[tehsil]);

    if(sortedTehsils.length === 0){
      html += "<i>No Tehsil visible</i>";
    }
    else{
      sortedTehsils.forEach(function(tehsil){
        var color = getTehsilColor(tehsil);

        html += `
          <div class="legend-item">
            <div class="legend-color" style="background:${color}"></div>
            ${tehsil}
          </div>
        `;
      });
    }
  }
  else{
    var sortedMarkaz = getFilterOrder("markazFilterBox")
      .filter(markaz => visibleMarkaz[markaz]);

    if(sortedMarkaz.length === 0){
      html += "<i>No Markaz visible</i>";
    }
    else{
      sortedMarkaz.forEach(function(markaz){
        var color = markazColors[markaz];

        if(color){
          html += `
            <div class="legend-item">
              <div class="legend-color" style="background:${color}"></div>
              ${markaz}
            </div>
          `;
        }
      });
    }
  }

  html += `
    </div>
    <div class="legend-section"><b>Marker Type</b><br>
      <div class="legend-item"><span class="legend-symbol legend-symbol-circle"></span>SED Primary</div>
      <div class="legend-item"><span class="legend-symbol legend-symbol-middle"></span>SED Middle</div>
      <div class="legend-item"><span class="legend-symbol legend-symbol-diamond"></span>PSRP / PEIMA</div>
      <div class="legend-item"><span class="legend-symbol legend-symbol-circle legend-symbol-highlight"></span>Search match</div>
    </div>
  `;

  legend.innerHTML = html;
}
function updateLabels(){
  var zoom = map.getZoom();

  markers.forEach(marker => {
    if(zoom >= 13 && map.hasLayer(marker)) marker.openTooltip();
    else marker.closeTooltip();
  });
}

map.on("zoomend", updateLabels);

document.getElementById("searchBox").addEventListener("input", function(){
  var q = getSearchQuery();

  if(q){
    syncFiltersToSchools(getSearchResults(q));
  }
  else{
    selectAllFilters();
  }

  showSchools();
});

function searchSchool(){
  var q = getSearchQuery();

  if(!q){
    showSchools();
    return;
  }

  syncFiltersToSchools(getSearchResults(q));
  showSchools();
}

function clearSearch(){
  document.getElementById("searchBox").value = "";
  selectAllFilters();
  showSchools();
}

function getSearchQuery(){
  return document.getElementById("searchBox").value.trim().toLowerCase();
}

function matchesSearch(s, q){
  return !q || s.name.toLowerCase().includes(q);
}

function getSearchResults(q){
  return schools.filter(function(s){
    return matchesSearch(s, q);
  });
}

function syncFiltersToSchools(matchingSchools){
  var values = {
    tehsilFilterBox: new Set(),
    markazFilterBox: new Set(),
    genderFilterBox: new Set(),
    levelFilterBox: new Set(),
    categoryFilterBox: new Set()
  };

  matchingSchools.forEach(function(s){
    values.tehsilFilterBox.add(s.tehsil);
    values.markazFilterBox.add(s.markaz);
    values.genderFilterBox.add(s.gender);
    values.levelFilterBox.add(s.level);
    values.categoryFilterBox.add(s.category);
  });

  setCheckedByValues("tehsilFilterBox", values.tehsilFilterBox);
  updateMarkazFilter();
  setCheckedByValues("markazFilterBox", values.markazFilterBox);
  setCheckedByValues("genderFilterBox", values.genderFilterBox);
  setCheckedByValues("levelFilterBox", values.levelFilterBox);
  setCheckedByValues("categoryFilterBox", values.categoryFilterBox);
}

function setCheckedByValues(id, values){
  document.querySelectorAll("#" + id + " input").forEach(function(cb){
    cb.checked = values.has(cb.value);
  });
}

function selectAllFilters(){
  ["tehsilFilterBox", "genderFilterBox", "levelFilterBox", "categoryFilterBox"].forEach(function(id){
    document.querySelectorAll("#" + id + " input").forEach(function(cb){
      cb.checked = true;
    });
  });

  updateMarkazFilter({
    selectAllVisible: true
  });
}

function toggleFilterPanel(){
  var controls = document.getElementById("controls");
  var toggle = document.getElementById("filterToggle");
  var isOpen = controls.classList.toggle("filters-open");

  if(toggle){
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  closeDropdowns();
  setTimeout(function(){
    map.invalidateSize();
  }, 0);
}

function toggleDropdown(id){
  var el = document.getElementById(id);
  var isOpen = el.style.display === "block";

  closeDropdowns();

  if(!isOpen){
    el.style.display = "block";
    setDropdownButtonExpanded(id, true);
  }
}

function setDropdownButtonExpanded(id, expanded){
  var button = document.querySelector("[data-filter-button='" + id + "']");

  if(button){
    button.setAttribute("aria-expanded", expanded ? "true" : "false");
  }
}

function toggleLegend(){
  var legend = document.getElementById("legend");
  var toggle = document.getElementById("legendToggle");
  var isOpen = legend.classList.toggle("legend-open");

  if(toggle){
    toggle.textContent = isOpen ? "Hide legend" : "Legend";
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }
}

function closeDropdowns(){
  document.querySelectorAll(".dropdown-content").forEach(dropdown => {
    dropdown.style.display = "none";
    setDropdownButtonExpanded(dropdown.id, false);
  });
}

document.addEventListener("click", function(e){
  if(!e.target.closest(".dropdown")){
    closeDropdowns();
  }
});
function copyCoords(text){
  if(!navigator.clipboard || !navigator.clipboard.writeText){
    window.prompt("Copy coordinates:", text);
    return;
  }

  navigator.clipboard.writeText(text).catch(function(){
    window.prompt("Copy coordinates:", text);
  });
}

function updateStats(s){
  var genderTotal = getStatsTotal(s.gender);
  var levelTotal = getStatsTotal(s.level);
  var categoryTotal = getStatsTotal(s.category);

  var html = `
    <b>Total Schools:</b> ${s.total}<br><br>

    <b>Tehsil Total (${s.total}):</b><br>
  `;

  getFilterOrder("tehsilFilterBox").forEach(tehsil => {
    html += `${tehsil}: ${s.tehsil[tehsil] || 0}<br>`;
  });

  html += `<br>
    <b>Markaz Total (${s.total}):</b><br>
  `;

  getFilterOrder("markazFilterBox").forEach(markaz => {
    html += `${markaz}: ${s.markaz[markaz] || 0}<br>`;
  });

  html += `<br>
    <b>Gender Total (${genderTotal}):</b><br>
  `;

  html += renderStatsByOrder(s.gender, getFilterOrder("genderFilterBox"));
  html += `<br>

    <b>Level Total (${levelTotal}):</b><br>
  `;

  html += renderStatsByOrder(s.level, getFilterOrder("levelFilterBox"));
  html += `<br>

    <b>Category Total (${categoryTotal}):</b><br>
  `;

  html += renderStatsByOrder(s.category, getFilterOrder("categoryFilterBox"));

  document.getElementById("statsBox").innerHTML = html;
}

function updateFilterSummary(stats, searchQuery){
  var parts = ["Showing " + stats.total + " school" + (stats.total === 1 ? "" : "s")];

  if(searchQuery){
    parts.push("Search: " + document.getElementById("searchBox").value.trim());
  }

  addSummaryPart(parts, "Tehsil", "tehsilFilterBox");
  addSummaryPart(parts, "Markaz", "markazFilterBox");
  addSummaryPart(parts, "Gender", "genderFilterBox");
  addSummaryPart(parts, "Level", "levelFilterBox");
  addSummaryPart(parts, "Category", "categoryFilterBox");

  var filterSummaryParts = parts.slice();
  addCountSummaryPart(parts, "Tehsil Count", stats.tehsil, getFilterOrder("tehsilFilterBox"));
  addCountSummaryPart(parts, "Level Count", stats.level, getFilterOrder("levelFilterBox"));
  addCountSummaryPart(parts, "Category Count", stats.category, getFilterOrder("categoryFilterBox"));

  document.getElementById("filterSummary").textContent = parts.join(" | ");
  updateFilterToggleMeta(filterSummaryParts);
}

function addCountSummaryPart(parts, label, stats, order){
  var countText = order
    .filter(function(value){
      return stats[value] > 0;
    })
    .map(function(value){
      return value + ": " + stats[value];
    })
    .join(", ");

  if(countText){
    parts.push(label + ": " + countText);
  }
}

function updateFilterToggleMeta(parts){
  var meta = document.getElementById("filterToggleMeta");

  if(meta){
    meta.textContent = parts.length > 1 ? (parts.length - 1) + " active" : "All";
  }
}
function updateFilterButtonLabels(){
  Object.keys(FILTER_LABELS).forEach(function(id){
    var button = document.querySelector("[data-filter-button='" + id + "']");
    var inputs = document.querySelectorAll("#" + id + " input");
    var selected = getSelected(id).length;
    var label = FILTER_LABELS[id];

    if(button){
      button.innerHTML = label + " (" + selected + ") &#9662;";
    }
  });
}

function addSummaryPart(parts, label, id){
  var inputs = [...document.querySelectorAll("#" + id + " input")];
  var selected = inputs.filter(input => input.checked).map(input => input.value);

  if(selected.length === 0){
    parts.push(label + ": none");
  }
  else if(selected.length === 1){
    parts.push(label + ": " + selected[0]);
  }
  else if(selected.length < inputs.length){
    parts.push(label + ": " + selected.length + " selected");
  }
}

function updateFilterCounts(searchQuery){
  var configs = [
    { id: "tehsilFilterBox", field: "tehsil" },
    { id: "markazFilterBox", field: "markaz" },
    { id: "genderFilterBox", field: "gender" },
    { id: "levelFilterBox", field: "level" },
    { id: "categoryFilterBox", field: "category" }
  ];

  configs.forEach(function(config){
    var counts = getCountsForFilter(config, searchQuery);

    document.querySelectorAll("#" + config.id + " input").forEach(function(input){
      var label = input.parentElement.querySelector(".filter-label-text");

      if(label){
        label.textContent = input.value + " (" + (counts[input.value] || 0) + ")";
      }
    });
  });
}

function getCountsForFilter(config, searchQuery){
  var selected = {
    tehsil: getSelected("tehsilFilterBox"),
    markaz: getSelected("markazFilterBox"),
    gender: getSelected("genderFilterBox"),
    level: getSelected("levelFilterBox"),
    category: getSelected("categoryFilterBox")
  };
  var counts = {};

  schools.forEach(function(s){
    if(
      matchesSearch(s, searchQuery) &&
      matchesOtherFilters(s, selected, config.field)
    ){
      counts[s[config.field]] = (counts[s[config.field]] || 0) + 1;
    }
  });

  return counts;
}

function matchesOtherFilters(s, selected, ignoredField){
  return (
    (ignoredField === "tehsil" || selected.tehsil.includes(s.tehsil)) &&
    (ignoredField === "markaz" || selected.markaz.includes(s.markaz)) &&
    (ignoredField === "gender" || selected.gender.includes(s.gender)) &&
    (ignoredField === "level" || selected.level.includes(s.level)) &&
    (ignoredField === "category" || selected.category.includes(s.category))
  );
}

function getStatsTotal(stats){
  return Object.keys(stats).reduce(function(total, key){
    return total + stats[key];
  }, 0);
}

function renderStatsByOrder(stats, order){
  var html = "";

  order.forEach(function(value){
    html += `${value}: ${stats[value] || 0}<br>`;
  });

  return html;
}

function getFilterOrder(id){
  return [...document.querySelectorAll("#" + id + " input")]
    .map(input => input.value);
}
