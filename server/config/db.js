const mongoose = require("mongoose");

function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn("[db] MONGODB_URI not set. Decision API routes will return 503 until the database is configured.");
    return false;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("[db] MongoDB connected");
    return true;
  } catch (error) {
    console.error("[db] MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

module.exports = { connectDB, isDatabaseReady };
