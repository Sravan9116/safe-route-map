const express = require("express");
const axios = require("axios");
const cors = require("cors");
const twilio = require("twilio");
const path = require("path");
require("dotenv").config();

const app = express();

/* ===============================
   MIDDLEWARE
================================= */

app.use(cors());
app.use(express.json());

/* ===============================
   FRONTEND SERVING (ROOT FOLDER)
================================= */

// Absolute path to project root
const rootPath = path.resolve(__dirname, "..");

// Serve static files (css, js, etc.)
app.use(express.static(rootPath));

// Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(rootPath, "index.html"));
});

/* ===============================
   OSRM ROUTING
================================= */

const OSRM_URL = "http://router.project-osrm.org/route/v1";

const vehicleSpeedFactor = {
  car: 1.0,
  bike: 0.9,
  walk: 0.4,
  truck: 0.75
};

function getTrafficFactor() {
  const random = Math.random();
  if (random < 0.2) return 1.6;
  if (random < 0.5) return 1.3;
  return 1.0;
}

app.post("/api/navigation/route", async (req, res) => {
  try {
    const { startLat, startLng, endLat, endLng, vehicle } = req.body;

    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({ error: "Missing coordinates" });
    }

    const profile =
      vehicle === "walk" ? "foot" :
      vehicle === "bike" ? "bike" : "driving";

    const url = `${OSRM_URL}/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&steps=true&geometries=geojson`;

    const response = await axios.get(url);
    const route = response.data.routes[0];

    const trafficFactor = getTrafficFactor();
    const vehicleFactor = vehicleSpeedFactor[vehicle] || 1.0;

    route.adjustedDuration = route.duration * trafficFactor / vehicleFactor;
    route.trafficFactor = trafficFactor;

    res.json({ routes: [route] });

  } catch (err) {
    console.error("Routing Error:", err.message);
    res.status(500).json({ error: "Routing failed" });
  }
});

/* ===============================
   TWILIO WHATSAPP
================================= */

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

app.post("/api/emergency-whatsapp", async (req, res) => {
  try {
    const { latitude, longitude, reason } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: "Missing location coordinates"
      });
    }

    const messageBody = `
🚨 EMERGENCY ALERT 🚨

Reason: ${reason || "Emergency detected"}

📍 Live Location:
https://www.google.com/maps?q=${latitude},${longitude}
    `;

    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: process.env.EMERGENCY_CONTACT,
      body: messageBody
    });

    res.json({
      success: true,
      sid: message.sid
    });

  } catch (error) {
    console.error("Twilio Error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===============================
   START SERVER
================================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
