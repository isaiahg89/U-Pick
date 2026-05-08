const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { isDatabaseReady } = require("./config/db");
const healthRoutes = require("./routes/health");
const decisionRoutes = require("./routes/decisions");

const app = express();
const publicRoot = path.resolve(__dirname, "..");

// Security headers
app.use(helmet());

// Keep CORS simple for this project so local and hosted frontends can call the API.
app.use(cors());

// Cap request body at 10 KB to prevent oversized payload attacks
app.use(express.json({ limit: "10kb" }));
app.use(morgan("dev"));

app.use(express.static(publicRoot));

app.use("/api/health", healthRoutes);
app.use("/api/decisions", (req, res, next) => {
  if (isDatabaseReady()) {
    return next();
  }

  return res.status(503).json({
    message: "Database unavailable",
    error: "Set MONGODB_URI and restart the server.",
  });
});
app.use("/api/decisions", decisionRoutes);

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ message: "API route not found" });
  }

  return res.sendFile("index.html", { root: publicRoot });
});

module.exports = app;
