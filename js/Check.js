let map, startPoint, endPoint, startMarker, endMarker, routeLayer;
let currentVehicle = "car";
let navMarker, watchId;
let fullRoute = [], remainingRoute = [], steps = [], stepIndex = 0;
let lastPos = null, lastTime = null;
let currentSpeed = 0;

/* INIT MAP*/
map = L.map("map").setView([13.0827, 80.2707], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);


/* CREATE START MARKER*/
function createStart(lat, lng) {
  startPoint = { lat, lng };
  selectedStart = startPoint;

  if (startMarker) map.removeLayer(startMarker);

  startMarker = L.marker([lat, lng], { draggable: true })
    .addTo(map)
    .bindPopup("Start Location")
    .openPopup();

  startMarker.on("dragend", () => {
    const p = startMarker.getLatLng();
    startPoint = { lat: p.lat, lng: p.lng };
    selectedStart = startPoint;
    if (selectedEnd) buildRoute();
  });
}


/* GET GPS START */
navigator.geolocation.getCurrentPosition(
  p => {
    createStart(p.coords.latitude, p.coords.longitude);
    map.setView([p.coords.latitude, p.coords.longitude], 15);
  },
  () => createStart(13.0827, 80.2707),
  { enableHighAccuracy: true }
);


/* BUILD ROUTE */
async function buildRoute() {

  if (!selectedStart || !selectedEnd) {
    alert("Select start and destination");
    return;
  }

  startPoint = selectedStart;
  endPoint = selectedEnd;

  if (endMarker) map.removeLayer(endMarker);
  if (routeLayer) map.removeLayer(routeLayer);

  endMarker = L.marker([endPoint.lat, endPoint.lng])
    .addTo(map)
    .bindPopup("Destination");

  const route = await fetchRoute(currentVehicle);

  fullRoute = route.geometry.coordinates.map(c => ({
    lat: c[1],
    lng: c[0]
  }));

  remainingRoute = [...fullRoute];
  steps = route.legs[0].steps;
  stepIndex = 0;

  routeLayer = L.polyline(remainingRoute, {
    color: "#007aff",
    weight: 6
  }).addTo(map);

  map.fitBounds(routeLayer.getBounds(), { padding: [70, 70] });

  updateVehicleTimes();
}


/* FETCH ROUTE FROM BACKEND */
async function fetchRoute(vehicle) {

  const res = await fetch("http://localhost:5000/api/navigation/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startLat: startPoint.lat,
      startLng: startPoint.lng,
      endLat: endPoint.lat,
      endLng: endPoint.lng,
      vehicle
    })
  });

  const data = await res.json();
  return data.routes[0];
}


/* UPDATE VEHICLE TIMES*/
async function updateVehicleTimes() {

  for (const v of ["car","bike","walk","truck"]) {
    const r = await fetchRoute(v);

    document.getElementById(`time-${v}`).innerText =
      formatTime(r.adjustedDuration || r.duration) +
      " • " +
      formatDistance(r.distance);
  }
}


/* SELECT VEHICLE */
function selectVehicle(e, v) {
  document.querySelectorAll(".vehicle")
    .forEach(x => x.classList.remove("active"));

  e.currentTarget.classList.add("active");
  currentVehicle = v;

  if (selectedEnd) buildRoute();
}


/* START NAVIGATION*/
function startNavigation() {

  if (!remainingRoute.length) {
    alert("Build route first");
    return;
  }

  if (watchId) navigator.geolocation.clearWatch(watchId);

  if (navMarker) map.removeLayer(navMarker);

  navMarker = L.marker(startPoint, {
    icon: L.divIcon({
      html: `<div class="nav-dot"></div>`,
      className: ""
    })
  }).addTo(map);

  watchId = navigator.geolocation.watchPosition(
    onMove,
    null,
    { enableHighAccuracy: true, maximumAge: 1000 }
  );
}


/* GPS UPDATE */
function onMove(pos) {

  const cur = {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude
  };

  navMarker.setLatLng(cur);
  map.panTo(cur);

  updateSpeed(cur);
  updateRemainingRoute(cur);
  updateInstruction(cur);
  updateETA();
  checkArrival(cur);
}


/* SPEED CALCULATION */
function updateSpeed(cur) {

  const now = Date.now();

  if (lastPos && lastTime) {

    const d = map.distance(lastPos, cur);
    const t = (now - lastTime) / 1000;

    if (t > 0) {
      currentSpeed = (d / t) * 3.6;
    }

    document.getElementById("nav-speed").innerText =
      currentSpeed.toFixed(1) + " km/h";
  }

  lastPos = cur;
  lastTime = now;
}


/* REMAINING DISTANCE */
function updateRemainingRoute(cur) {

  while (remainingRoute.length &&
         map.distance(cur, remainingRoute[0]) < 20) {
    remainingRoute.shift();
  }

  let dist = 0;

  for (let i = 0; i < remainingRoute.length - 1; i++) {
    dist += map.distance(
      remainingRoute[i],
      remainingRoute[i + 1]
    );
  }

  document.getElementById("nav-distance").innerText =
    (dist / 1000).toFixed(2) + " km";

  if (routeLayer) map.removeLayer(routeLayer);

  routeLayer = L.polyline(remainingRoute, {
    color: "#007aff",
    weight: 6
  }).addTo(map);
}


/* ETA CALCULATION */
function updateETA() {

  if (!remainingRoute.length || currentSpeed <= 1) return;

  let dist = 0;

  for (let i = 0; i < remainingRoute.length - 1; i++) {
    dist += map.distance(
      remainingRoute[i],
      remainingRoute[i + 1]
    );
  }

  const etaMinutes = (dist / 1000) / currentSpeed * 60;

  document.getElementById("nav-eta").innerText =
    etaMinutes.toFixed(1) + " min";
}


/* TURN INSTRUCTIONS */
function updateInstruction(cur) {

  if (!steps[stepIndex]) return;

  const p = steps[stepIndex].maneuver.location;

  if (map.distance(cur, { lat: p[1], lng: p[0] }) < 30) {
    stepIndex++;
  }

  if (steps[stepIndex]) {
    document.getElementById("nav-instruction").innerText =
      steps[stepIndex].maneuver.instruction;
  }
}


/*ARRIVAL DETECTION */
function checkArrival(cur) {

  if (!endPoint) return;

  const dist = map.distance(cur, endPoint);

  if (dist < 20) {
    alert("You have arrived at your destination 🎉");
    navigator.geolocation.clearWatch(watchId);
  }
}


/* FORMATTERS*/
function formatTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

function formatDistance(m) {
  return m >= 1000
    ? (m/1000).toFixed(1)+" km"
    : Math.round(m)+" m";
}
