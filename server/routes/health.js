const express = require("express");

const { isDatabaseReady } = require("../config/db");

const router = express.Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "collectivechoice-api",
    database: isDatabaseReady() ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
