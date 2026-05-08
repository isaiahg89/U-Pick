const dotenv = require("dotenv");
const app = require("./app");
const { connectDB } = require("./config/db");

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`[server] Running at http://localhost:${PORT}`);
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

startServer();
