/* ==============================
   EMERGENCY DETECTION SYSTEM
============================== */

let shakeThreshold = 18;
let fallThreshold = 25;

let lastShakeTime = 0;
let emergencyTriggered = false;


/* ==============================
   ENABLE MOTION (iOS SUPPORT)
============================== */

function enableMotion() {

  if (typeof DeviceMotionEvent !== "undefined" &&
      typeof DeviceMotionEvent.requestPermission === "function") {

    DeviceMotionEvent.requestPermission()
      .then(permission => {
        if (permission === "granted") {
          window.addEventListener("devicemotion", detectMotion);
        } else {
          alert("Motion permission denied");
        }
      })
      .catch(console.error);

  } else {
    window.addEventListener("devicemotion", detectMotion);
  }
}


/* ==============================
   MOTION DETECTION
============================== */

function detectMotion(event) {

  const acc = event.accelerationIncludingGravity;
  if (!acc) return;

  const total = Math.sqrt(
    acc.x * acc.x +
    acc.y * acc.y +
    acc.z * acc.z
  );

  const now = Date.now();

  // SHAKE
  if (total > shakeThreshold) {
    if (now - lastShakeTime > 1000) {
      lastShakeTime = now;
      triggerEmergency("Shake detected");
    }
  }

  // FALL
  if (total > fallThreshold) {
    triggerEmergency("Possible fall detected");
  }
}


/* ==============================
   MANUAL EMERGENCY BUTTON
============================== */

function manualEmergency() {
  triggerEmergency("Manual emergency triggered");
}


/* ==============================
   MAIN EMERGENCY FUNCTION
============================== */

async function triggerEmergency(reason) {

  if (emergencyTriggered) return;
  emergencyTriggered = true;

  const status = document.getElementById("emergency-status");
  if (status) status.innerText = "🚨 Sending WhatsApp Alert...";

  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    emergencyTriggered = false;
    return;
  }

  navigator.geolocation.getCurrentPosition(

    async (position) => {

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      try {

        const response = await fetch(
          "http://localhost:5000/api/emergency-whatsapp",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude,
              longitude,
              reason
            })
          }
        );

        const data = await response.json();

        if (data.success) {
          if (status) status.innerText = "✅ WhatsApp Alert Sent!";
        } else {
          if (status) status.innerText = "❌ Failed to Send Alert";
        }

      } catch (err) {
        console.error(err);
        if (status) status.innerText = "❌ Server Error";
      }

    },

    (error) => {
      alert("Location permission required for emergency alert");
      console.error(error);
      emergencyTriggered = false;
    },

    { enableHighAccuracy: true }

  );

  setTimeout(() => {
    emergencyTriggered = false;
  }, 15000);
}
