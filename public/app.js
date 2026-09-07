const socket = io();
let watchId = null;
let map = null;
let marker = null;
let circle = null;

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove("hidden");
const hide = id => $(id).classList.add("hidden");

$("createBtn").onclick = async () => {
  const r = await fetch("/api/sessions", {method:"POST"});
  const data = await r.json();
  $("shareId").textContent = data.id;
  show("share");
  hide("home");
  socket.emit("join", {sessionId:data.id, role:"sharer"});
};

$("joinBtn").onclick = () => {
  const id = $("sessionInput").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(id)) return alert("Enter a valid 8-character session ID.");
  $("viewId").textContent = id;
  show("view");
  hide("home");
  initMap();
  socket.emit("join", {sessionId:id, role:"viewer"});
};

$("startBtn").onclick = () => {
  if (!navigator.geolocation) {
    $("shareInfo").textContent = "This browser does not support geolocation.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    () => {
      socket.emit("sharingStarted");
      watchId = navigator.geolocation.watchPosition(
        position => {
          const c = position.coords;
          socket.emit("location", {
            lat:c.latitude,
            lng:c.longitude,
            accuracy:c.accuracy
          });
        },
        err => $("shareInfo").textContent = "Location error: " + err.message,
        {enableHighAccuracy:true, maximumAge:5000, timeout:15000}
      );
      $("startBtn").disabled = true;
      $("stopBtn").disabled = false;
      $("shareStatus").textContent = "Sharing";
      $("shareInfo").textContent = "Your browser is now sharing your location for this session.";
    },
    err => {
      $("shareInfo").textContent =
        "Location permission was not granted. Please allow location access and try again.";
    },
    {enableHighAccuracy:true, timeout:15000}
  );
};

$("stopBtn").onclick = stopSharing;

function stopSharing(){
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  socket.emit("sharingStopped");
  $("startBtn").disabled = false;
  $("stopBtn").disabled = true;
  $("shareStatus").textContent = "Not sharing";
  $("shareInfo").textContent = "Location sharing has stopped.";
}

function initMap(){
  if (map) return;
  map = L.map("map").setView([20.5937,78.9629],5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:"© OpenStreetMap contributors"
  }).addTo(map);
}

socket.on("sharingState", sharing => {
  if (!$("view").classList.contains("hidden")) {
    $("viewStatus").textContent = sharing ? "Live" : "Not sharing";
  }
});

socket.on("location", loc => {
  if (!$("view").classList.contains("hidden")) {
    if (!loc) {
      $("viewStatus").textContent = "Not sharing";
      $("locationDetails").textContent = "The location owner stopped sharing.";
      if (marker) { map.removeLayer(marker); marker=null; }
      if (circle) { map.removeLayer(circle); circle=null; }
      return;
    }

    $("viewStatus").textContent = "Live";
    const point = [loc.lat, loc.lng];

    if (!marker) {
      marker = L.marker(point).addTo(map).bindPopup("Shared device");
      map.setView(point,16);
    } else {
      marker.setLatLng(point);
      map.panTo(point);
    }

    if (circle) circle.setLatLng(point).setRadius(loc.accuracy);
    else circle = L.circle(point,{radius:loc.accuracy}).addTo(map);

    $("locationDetails").innerHTML =
      `<strong>Latitude:</strong> ${loc.lat.toFixed(6)}<br>`+
      `<strong>Longitude:</strong> ${loc.lng.toFixed(6)}<br>`+
      `<strong>Accuracy:</strong> ±${Math.round(loc.accuracy)} m<br>`+
      `<strong>Last update:</strong> ${new Date(loc.timestamp).toLocaleString()}`;
  }
});

socket.on("state", state => {
  if (!$("view").classList.contains("hidden")) {
    $("viewStatus").textContent = state.sharing ? "Live" : "Waiting";
    if (state.location) socket.emit("requestRefresh");
  }
});

socket.on("errorMessage", msg => alert(msg));
