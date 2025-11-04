import "dotenv/config";
import app from "./app";
import { runUserCleanup } from './services/cleanup.service'; // <-- Import the cleanup service

const PORT = Number(process.env.PORT || 3000);
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
const server = app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);

  // Run the cleanup task immediately on startup...
  runUserCleanup();
  // ...and then run it again every 24 hours.
  setInterval(runUserCleanup, ONE_DAY_IN_MS);
});

process.on("SIGINT", () => {
  server.close(() => console.log("Exit Server Express"));
});
