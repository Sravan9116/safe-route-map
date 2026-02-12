let debounceTimer;

function suggestPlaces(query, type) {

  if (query.length < 3) return;

  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {

    const box = document.getElementById(
      type === "start" ? "startSuggestions" : "endSuggestions"
    );

    box.innerHTML = "";

    const url =
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8`;

    try {

      const res = await fetch(url);
      const data = await res.json();

      data.features.forEach(place => {

        const name = place.properties.name || "";
        const street = place.properties.street || "";
        const city = place.properties.city || "";
        const state = place.properties.state || "";

        const display = `${name} ${street}, ${city}, ${state}`;

        const div = document.createElement("div");
        div.className = "suggestion-item";
        div.innerText = display;

        div.onclick = () => {

          document.getElementById(type + "Input").value = display;

          const lat = place.geometry.coordinates[1];
          const lng = place.geometry.coordinates[0];

          if (type === "start") {
            setStart(lat, lng);
          } else {
            setDestination(lat, lng);
          }

          box.innerHTML = "";
        };

        box.appendChild(div);
      });

    } catch (err) {
      console.error("Search error:", err);
    }

  }, 300);
}
