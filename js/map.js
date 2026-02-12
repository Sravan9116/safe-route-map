/* ======================================
   GLOBAL VARIABLES
====================================== */

let map;
let startPoint = null;
let endPoint = null;

let startMarker = null;
let endMarker = null;
let routeLayer = null;
let navMarker = null;

let watchId = null;
let currentVehicle = "car";

let fullRoute = [];
let remainingRoute = [];
let steps = [];
let stepIndex = 0;

let lastPos = null;
let lastTime = null;
let currentSpeed = 0;


/* ======================================
   INIT MAP
====================================== */

map = L.map("map").setView([13.0827, 80.2707], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);


/* ======================================
   ASK LOCATION PERMISSION ONLY ONCE
====================================== */

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    position => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setStart(lat, lng);
      map.setView([lat, lng], 15);
    },
    () => {
      console.log("Location permission denied");
    },
    { enableHighAccuracy: true }
  );
}


/* ======================================
   SET START
====================================== */

function setStart(lat, lng) {

  startPoint = { lat, lng };

  if (startMarker) map.removeLayer(startMarker);

  startMarker = L.marker([lat, lng], { draggable: true })
    .addTo(map)
    .bindPopup("Start Location")
    .openPopup();

  startMarker.on("dragend", () => {
    const p = startMarker.getLatLng();
    startPoint = { lat: p.lat, lng: p.lng };
  });
}


/* ======================================
   SET DESTINATION
====================================== */

function setDestination(lat, lng) {

  endPoint = { lat, lng };

  if (endMarker) map.removeLayer(endMarker);

  endMarker = L.marker([lat, lng])
    .addTo(map)
    .bindPopup("Destination")
    .openPopup();
}


/* ======================================
   BUILD ROUTE
====================================== */

async function buildRoute() {

  if (!startPoint) {
    alert("Select start location");
    return;
  }

  if (!endPoint) {
    alert("Select destination");
    return;
  }

  if (routeLayer) map.removeLayer(routeLayer);

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


/* ======================================
   FETCH ROUTE
====================================== */

async function fetchRoute(vehicle) {

  const res = await fetch(" https://64f8-103-182-68-20.ngrok-free.app/api/navigation/route", {
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


/* ======================================
   UPDATE VEHICLE TIMES
====================================== */

async function updateVehicleTimes() {

  for (const v of ["car","bike","walk","truck"]) {

    const r = await fetchRoute(v);

    document.getElementById(`time-${v}`).innerText =
      formatTime(r.adjustedDuration || r.duration) +
      " • " +
      formatDistance(r.distance);
  }
}


/* ======================================
   SELECT VEHICLE
====================================== */

function selectVehicle(e, v) {

  document.querySelectorAll(".vehicle")
    .forEach(x => x.classList.remove("active"));

  e.currentTarget.classList.add("active");

  currentVehicle = v;

  if (startPoint && endPoint) buildRoute();
}


/* ======================================
   START NAVIGATION
====================================== */

async function startNavigation() {

  if (!startPoint || !endPoint) {
    alert("Select start and destination first");
    return;
  }

  if (!remainingRoute.length) {
    await buildRoute();
  }

  beginNavigation();
}


function beginNavigation() {

  if (watchId) navigator.geolocation.clearWatch(watchId);

  if (navMarker) map.removeLayer(navMarker);

  navMarker = L.marker([startPoint.lat, startPoint.lng], {
    icon: L.divIcon({
      html: `<div class="nav-dot"></div>`,
      className: ""
    })
  }).addTo(map);

  map.setView([startPoint.lat, startPoint.lng], 15);

  watchId = navigator.geolocation.watchPosition(
    onMove,
    null,
    { enableHighAccuracy: true, maximumAge: 1000 }
  );
}


/* ======================================
   GPS LIVE UPDATE
====================================== */

function onMove(position) {

  const cur = {
    lat: position.coords.latitude,
    lng: position.coords.longitude
  };

  navMarker.setLatLng(cur);
  map.panTo(cur);

  updateSpeed(cur);
  updateRemainingRoute(cur);
  updateInstruction(cur);
  updateETA();
  checkArrival(cur);
}


/* ======================================
   SPEED
====================================== */

function updateSpeed(cur) {

  const now = Date.now();

  if (lastPos && lastTime) {

    const d = map.distance(lastPos, cur);
    const t = (now - lastTime) / 1000;

    if (t > 0) currentSpeed = (d / t) * 3.6;

    document.getElementById("nav-speed").innerText =
      currentSpeed.toFixed(1) + " km/h";
  }

  lastPos = cur;
  lastTime = now;
}


/* ======================================
   REMAINING DISTANCE
====================================== */

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
}


/* ======================================
   ETA
====================================== */

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


/* ======================================
   TURN INSTRUCTIONS
====================================== */

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


/* ======================================
   ARRIVAL
====================================== */

function checkArrival(cur) {

  if (!endPoint) return;

  const dist = map.distance(cur, endPoint);

  if (dist < 20) {
    alert("You have arrived 🎉");
    navigator.geolocation.clearWatch(watchId);
  }
}


/* ======================================
   FORMATTERS
====================================== */

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

function formatDistance(meters) {
  return meters >= 1000
    ? (meters / 1000).toFixed(1) + " km"
    : Math.round(meters) + " m";
}
