import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import api from "../../lib/axios";
import { useAuthStore } from "../../store/useAuthStore";
import { message } from "../author/images";
import type { ChatMessage } from "./types";

interface Handlers {
  message: (m: ChatMessage) => void;
  changed: () => void;
  revoked: (message: string) => void;
  reconnected: () => void;
}
export function useChatConnection(
  conversationId: number | null,
  handlers: Handlers,
) {
  const userId = useAuthStore((s) => s.authUser?.id),
    callbacks = useRef(handlers);
  const selected = useRef(conversationId),
    joinRef = useRef<() => void>(() => {});
  const [state, setState] = useState("Connecting…");
  useEffect(() => {
    callbacks.current = handlers;
    selected.current = conversationId;
  });
  useEffect(() => {
    if (!userId) return;
    let active = true,
      timer: ReturnType<typeof setTimeout>,
      joinTimer: ReturnType<typeof setTimeout>;
    const socket = io(
      import.meta.env.DEV ? "http://localhost:3000" : window.location.origin,
      {
        autoConnect: false,
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        auth: (done) => {
          void api
            .get("/user/me")
            .then(() => {
              if (active)
                done({ userId, token: useAuthStore.getState().accessToken });
            })
            .catch((e: unknown) => {
              if (active) {
                setState(message(e));
                timer = setTimeout(() => socket.connect(), 5000);
              }
            });
        },
      },
    );
    function join(retry = 0) {
      const id = selected.current;
      if (!active || !socket.connected) return;
      clearTimeout(joinTimer);
      if (!id) {
        socket.emit("chat:leave");
        return;
      }
      socket
        .timeout(8000)
        .emit(
          "chat:join",
          id,
          (
            error: Error | null,
            result: { ok: boolean; message?: string; status?: number },
          ) => {
            if (!active || selected.current !== id) return;
            if (error) setState("Connection delayed. Reconnecting…");
            else if (result.status === 429 && retry < 1)
              joinTimer = setTimeout(() => join(retry + 1), 750);
            else if (result.status === 401) socket.disconnect().connect();
            else if (!result.ok)
              callbacks.current.revoked(
                result.message ?? "Conversation unavailable",
              );
            else {
              setState("Connected");
              callbacks.current.reconnected();
            }
          },
        );
    }
    joinRef.current = () => join();
    socket.on("connect", () => {
      setState("Connected");
      join();
      callbacks.current.changed();
    });
    socket.on("connect_error", (e: Error) => {
      setState(e.message);
      clearTimeout(timer);
      timer = setTimeout(() => socket.connect(), 5000);
    });
    socket.on("disconnect", (reason) => {
      if (!active) return;
      setState("Reconnecting…");
      if (reason === "io server disconnect") {
        clearTimeout(timer);
        timer = setTimeout(() => socket.connect(), 1000);
      }
    });
    socket.on("chat:message", (m: ChatMessage) => callbacks.current.message(m));
    socket.on("chat:changed", () => callbacks.current.changed());
    socket.on(
      "chat:revoked",
      ({
        conversationId: id,
        message: text,
      }: {
        conversationId: number;
        message: string;
      }) => {
        if (id === selected.current) callbacks.current.revoked(text);
      },
    );
    socket.connect();
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(joinTimer);
      socket.disconnect();
      joinRef.current = () => {};
    };
  }, [userId]);
  useEffect(() => {
    joinRef.current();
  }, [conversationId]);
  return state;
}
