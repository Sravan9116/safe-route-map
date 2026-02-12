const express = require("express");
const axios = require("axios");
const cors = require("cors");
const twilio = require("twilio");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   OSRM ROUTING (UNCHANGED)
================================= */

const OSRM_URL = "http://router.project-osrm.org/route/v1";

const vehicleSpeedFactor = {
  car: 1.0,
  bike: 0.9,
  walk: 0.4,
  truck: 0.75
};

function getTrafficFactor(lat, lng) {
  const random = Math.random();
  if (random < 0.2) return 1.6;
  if (random < 0.5) return 1.3;
  return 1.0;
}

app.post("/api/navigation/route", async (req, res) => {
  const { startLat, startLng, endLat, endLng, vehicle } = req.body;

  try {
    const profile =
      vehicle === "walk" ? "foot" :
      vehicle === "bike" ? "bike" : "driving";

    const url = `${OSRM_URL}/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&steps=true&geometries=geojson`;

    const response = await axios.get(url);
    const route = response.data.routes[0];

    const trafficFactor = getTrafficFactor(startLat, startLng);
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
   TWILIO WHATSAPP EMERGENCY ALERT
================================= */

if (
  !process.env.TWILIO_ACCOUNT_SID ||
  !process.env.TWILIO_AUTH_TOKEN ||
  !process.env.TWILIO_WHATSAPP_NUMBER ||
  !process.env.EMERGENCY_CONTACT
) {
  console.error("❌ Missing Twilio environment variables!");
}

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

    console.log("🚨 Emergency WhatsApp triggered");
    console.log("Location:", latitude, longitude);

    const messageBody = `
🚨 *EMERGENCY ALERT* 🚨

Reason: ${reason || "Emergency detected"}

📍 Live Location:
https://www.google.com/maps?q=${latitude},${longitude}

Please check immediately.
    `;

    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,   // whatsapp:+14155238886
      to: process.env.EMERGENCY_CONTACT,          // whatsapp:+91XXXXXXXXXX
      body: messageBody
    });

    console.log("✅ WhatsApp Sent");
    console.log("Message SID:", message.sid);
    console.log("Status:", message.status);

    res.json({
      success: true,
      sid: message.sid,
      status: message.status
    });

  } catch (error) {

    console.error("❌ Twilio WhatsApp Error:");
    console.error("Code:", error.code);
    console.error("Message:", error.message);

    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

/* =============================== */

app.listen(5000, () =>
  console.log("🚀 Smart Navigation Server running on port 5000")
);
