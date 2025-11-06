import "dotenv/config";
import app from "./app";

const PORT = Number(process.env.PORT || 3000);
const server = app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  server.close(() => console.log("Exit Server Express"));
});