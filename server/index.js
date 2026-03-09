// ─── FabTrack Server ─────────────────────────────────────────────────
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── API Routes ──
app.use("/api/auth", require("./routes/auth"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/photos", require("./routes/photos"));

// ── Health check ──
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Serve React frontend in production ──
if (process.env.NODE_ENV === "production") {
  const clientBuild = path.join(__dirname, "../client/dist");
  app.use(express.static(clientBuild));

  // All non-API routes serve the React app (SPA routing)
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api") && !req.path.startsWith("/uploads")) {
      res.sendFile(path.join(clientBuild, "index.html"));
    }
  });
}

// ── Error handling ──
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║  FabTrack Server                      ║
  ║  Running on port ${PORT}                 ║
  ║  ${process.env.NODE_ENV || "development"} mode                  ║
  ╚═══════════════════════════════════════╝
  `);
});
