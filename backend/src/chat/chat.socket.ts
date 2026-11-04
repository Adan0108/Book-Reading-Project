import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { verifySessionToken } from "../services/session.service";
import { isRevoked } from "../auth/checkAuth";
import { positiveId } from "../domain/validation";
import { AuthFailureError, ErrorResponse } from "../core/error.response";
import {
  chatEvents,
  conversationAccess,
  conversationParticipants,
  type ChatMessage,
} from "./chat.service";

interface ChatData {
  userId: number;
  token: string;
  conversationId?: number;
  nextJoinAt?: number;
}
interface ClientEvents {
  "chat:join": (
    id: unknown,
    ack: (reply: {
      ok: boolean;
      conversationId?: number;
      canSend?: boolean;
      message?: string;
      status?: number;
    }) => void,
  ) => void;
  "chat:leave": () => void;
}
interface ServerEvents {
  "chat:changed": (change: { conversationId: number }) => void;
  "chat:message": (message: ChatMessage) => void;
  "chat:revoked": (change: {
    conversationId: number;
    message: string;
    status: number;
  }) => void;
}
type ChatSocket = Socket<
  ClientEvents,
  ServerEvents,
  Record<string, never>,
  ChatData
>;
async function authenticate(socket: ChatSocket) {
  const userId = positiveId(socket.handshake.auth.userId, "account"),
    token = socket.handshake.auth.token;
  if (typeof token !== "string" || token.length > 8192)
    throw new AuthFailureError("Sign in again");
  const session = await verifySessionToken(token, userId, "access");
  if (await isRevoked(session.uid, session.jti))
    throw new AuthFailureError("Session revoked");
  socket.data.userId = userId;
  socket.data.token = token;
}
function errorMessage(error: unknown) {
  return error instanceof ErrorResponse
    ? { message: error.message, status: error.status }
    : { message: "Chat is temporarily unavailable", status: 503 };
}

export function attachChat(server: HttpServer) {
  const origin = process.env.FRONTEND_URL ?? "http://localhost:8000";
  const io = new Server<
    ClientEvents,
    ServerEvents,
    Record<string, never>,
    ChatData
  >(server, {
    cors: { origin, credentials: true },
    allowRequest: (req, done) => done(null, req.headers.origin === origin),
    maxHttpBufferSize: 16384,
    connectTimeout: 10000,
  });
  // Recovery is application-level: never replay cached protected packets after membership expiry.
  io.use((socket, next) => {
    void authenticate(socket)
      .then(() => {
        const count = [...io.sockets.sockets.values()].filter(
          (s) => s.data.userId === socket.data.userId,
        ).length;
        if (count >= 5)
          throw new ErrorResponse("Too many chat connections", 429);
        next();
      })
      .catch((error) => {
        const e = new Error(errorMessage(error).message);
        next(e);
      });
  });
  io.on("connection", (socket) => {
    socket.on("chat:join", (input: unknown, ack: unknown) => {
      const reply = typeof ack === "function" ? ack : () => {};
      void (async () => {
        if (Date.now() < (socket.data.nextJoinAt ?? 0))
          throw new ErrorResponse(
            "Please wait before switching conversations",
            429,
          );
        socket.data.nextJoinAt = Date.now() + 500;
        await authenticate(socket);
        const id = positiveId(input, "conversation"),
          access = await conversationAccess(socket.data.userId, id);
        socket.data.conversationId = id;
        reply({ ok: true, conversationId: id, canSend: access.canSend });
      })().catch((error) => reply({ ok: false, ...errorMessage(error) }));
    });
    socket.on("chat:leave", () => {
      delete socket.data.conversationId;
    });
  });
  async function deliver(message?: ChatMessage, changeId?: number) {
    const conversationId = message?.conversationId ?? changeId!;
    const participants = await conversationParticipants(conversationId);
    await Promise.all(
      [...io.sockets.sockets.values()]
        .filter((socket) => participants.includes(socket.data.userId))
        .map(async (socket) => {
          try {
            await authenticate(socket);
            await conversationAccess(socket.data.userId, conversationId);
            socket.emit("chat:changed", { conversationId });
            if (message && socket.data.conversationId === conversationId)
              socket.emit("chat:message", message);
          } catch (error) {
            if (socket.data.conversationId === conversationId) {
              delete socket.data.conversationId;
              socket.emit("chat:revoked", {
                conversationId,
                ...errorMessage(error),
              });
            }
          }
        }),
    );
  }
  const onMessage = (message: ChatMessage) => {
    void deliver(message).catch(() => {});
  };
  const onChange = ({ conversationId }: { conversationId: number }) => {
    void deliver(undefined, conversationId).catch(() => {});
  };
  chatEvents.on("message", onMessage);
  chatEvents.on("changed", onChange);
  const heartbeat = setInterval(() => {
    for (const socket of io.sockets.sockets.values()) {
      void authenticate(socket)
        .then(async () => {
          if (socket.data.conversationId) {
            try {
              const access = await conversationAccess(
                socket.data.userId,
                socket.data.conversationId,
              );
              if (!access.canSend)
                socket.emit("chat:changed", {
                  conversationId: socket.data.conversationId,
                });
            } catch (error) {
              const id = socket.data.conversationId;
              delete socket.data.conversationId;
              socket.emit("chat:revoked", {
                conversationId: id,
                ...errorMessage(error),
              });
            }
          }
        })
        .catch(() => socket.disconnect(true));
    }
  }, 15000);
  heartbeat.unref();
  server.once("close", () => {
    clearInterval(heartbeat);
    chatEvents.off("message", onMessage);
    chatEvents.off("changed", onChange);
  });
  return io;
}
