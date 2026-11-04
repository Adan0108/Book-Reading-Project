import "dotenv/config";
import app from "./app";
import { createServer } from 'node:http';
import { attachChat } from './chat/chat.socket';

const PORT = Number(process.env.PORT || 3000);
const server = createServer(app);
const chat=attachChat(server);
server.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  chat.close(() => console.log("Exit Server Express"));
});
