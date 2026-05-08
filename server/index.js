const dotenv = require("dotenv");
const app = require("./app");
const { connectDB } = require("./config/db");

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  const databaseConnected = await connectDB();

  if (!databaseConnected) {
    console.warn("[server] Starting without a database connection. Decision API routes will return 503 until MongoDB is reachable.");
  }

  const server = app.listen(PORT, () => {
    console.log(`[server] Running on port ${PORT}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`[server] Port ${PORT} is already in use. Stop the other process or set a different PORT in .env.`);
      process.exit(1);
    }

    console.error("[server] Failed to start:", error.message);
    process.exit(1);
  });
}

startServer().catch((error) => {
  console.error("[server] Fatal startup error:", error);
  process.exit(1);
});
