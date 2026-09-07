const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const sessions = new Map();

function makeId() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

app.post("/api/sessions", (req, res) => {
  let id = makeId();
  while (sessions.has(id)) id = makeId();
  sessions.set(id, {
    id,
    createdAt: Date.now(),
    sharing: false,
    location: null,
    trackerSocket: null,
    viewerCount: 0
  });
  res.json({ id });
});

app.get("/api/sessions/:id", (req, res) => {
  const session = sessions.get(req.params.id.toUpperCase());
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json({
    id: session.id,
    sharing: session.sharing,
    location: session.location,
    viewerCount: session.viewerCount
  });
});

io.on("connection", socket => {
  socket.on("join", ({ sessionId, role }) => {
    const id = String(sessionId || "").toUpperCase();
    const session = sessions.get(id);
    if (!session || !["sharer", "viewer"].includes(role)) {
      socket.emit("errorMessage", "Invalid tracking session.");
      return;
    }

    socket.join(id);
    socket.data.sessionId = id;
    socket.data.role = role;

    if (role === "sharer") {
      if (session.trackerSocket && session.trackerSocket !== socket.id) {
        socket.emit("errorMessage", "A sharing device is already connected.");
        return;
      }
      session.trackerSocket = socket.id;
      socket.emit("state", {
        sharing: session.sharing,
        location: session.location
      });
    } else {
      session.viewerCount++;
      socket.emit("state", {
        sharing: session.sharing,
        location: session.location
      });
      io.to(id).emit("viewerCount", session.viewerCount);
    }
  });

  socket.on("sharingStarted", () => {
    const session = sessions.get(socket.data.sessionId);
    if (!session || socket.data.role !== "sharer") return;
    session.sharing = true;
    io.to(session.id).emit("sharingState", true);
  });

  socket.on("sharingStopped", () => {
    const session = sessions.get(socket.data.sessionId);
    if (!session || socket.data.role !== "sharer") return;
    session.sharing = false;
    session.location = null;
    io.to(session.id).emit("sharingState", false);
    io.to(session.id).emit("location", null);
  });

  socket.on("location", loc => {
    const session = sessions.get(socket.data.sessionId);
    if (!session || socket.data.role !== "sharer" || !session.sharing) return;
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return;

    session.location = {
      lat: loc.lat,
      lng: loc.lng,
      accuracy: Number(loc.accuracy || 0),
      timestamp: Date.now()
    };
    io.to(session.id).emit("location", session.location);
  });

  socket.on("disconnect", () => {
    const id = socket.data.sessionId;
    const role = socket.data.role;
    const session = sessions.get(id);
    if (!session) return;

    if (role === "sharer" && session.trackerSocket === socket.id) {
      session.trackerSocket = null;
      session.sharing = false;
      session.location = null;
      io.to(id).emit("sharingState", false);
      io.to(id).emit("location", null);
    }

    if (role === "viewer") {
      session.viewerCount = Math.max(0, session.viewerCount - 1);
      io.to(id).emit("viewerCount", session.viewerCount);
    }
  });
});

app.get("*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Tracker running at http://localhost:${PORT}`);
});