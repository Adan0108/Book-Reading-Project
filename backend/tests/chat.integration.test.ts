import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";
import express from "express";
import request from "supertest";
import { io, type Socket } from "socket.io-client";
import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { configureQaEnvironment } from "./qa-environment";
const enabled = process.env.PUBLISHING_TEST_DATABASE === "publishing_qa";
describe.skipIf(!enabled)(
  "real MySQL and Socket.IO member conversations",
  () => {
    let pool: Pool,
      redis: typeof import("../src/dbs/init.redis"),
      chat: typeof import("../src/chat/chat.service"),
      sessions: typeof import("../src/services/session.service");
    let server: HttpServer,
      hub: ReturnType<typeof import("../src/chat/chat.socket").attachChat>,
      url: string,
      author: number,
      authorId: number,
      member: number,
      outsider: number,
      admin: number,
      tier: number,
      grant: number,
      conversation: number;
    let memberSocket: Socket,
      authorSocket: Socket,
      memberToken: string,
      authorToken: string;
    const app = express(),
      sockets: Socket[] = [];
    async function user(role: string) {
      const [u] = await pool.query<ResultSetHeader>(
        "INSERT INTO users(email,password_hash,state) VALUES (?,'fixture-only',1)",
        [`chat-${randomUUID()}@example.invalid`],
      );
      await pool.query(
        "INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE code=?",
        [u.insertId, role],
      );
      return u.insertId;
    }
    async function membership(uid: number) {
      const [m] = await pool.query<ResultSetHeader>(
        "INSERT INTO memberships(user_id,author_id,tier_id,status,started_at,current_period_end,provider) VALUES (?,?,?,'ACTIVE',DATE_SUB(NOW(),INTERVAL 1 DAY),DATE_ADD(NOW(),INTERVAL 1 DAY),'MANUAL')",
        [uid, authorId, tier],
      );
      return m.insertId;
    }
    async function connect(
      uid: number,
      token: string,
      origin = "http://localhost:8000",
    ) {
      const socket = io(url, {
        transports: ["websocket"],
        reconnection: false,
        auth: { userId: uid, token },
        extraHeaders: { Origin: origin },
      });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("connect_error", reject);
      });
      return socket;
    }
    function event<T>(socket: Socket, name: string) {
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`No ${name} event`)),
          5000,
        );
        socket.once(name, (data: T) => {
          clearTimeout(timer);
          resolve(data);
        });
      });
    }
    beforeAll(async () => {
      configureQaEnvironment();
      process.env.FRONTEND_URL = "http://localhost:8000";
      ({ pool } = await import("../src/dbs/init.mysql"));
      await (await import("../src/dbs/migrate")).runMigrationsOnce();
      redis = await import("../src/dbs/init.redis");
      await redis.initRedis();
      chat = await import("../src/chat/chat.service");
      sessions = await import("../src/services/session.service");
      author = await user("AUTHOR");
      member = await user("READER");
      outsider = await user("READER");
      admin = await user("ADMIN");
      const [a] = await pool.query<ResultSetHeader>(
        "INSERT INTO authors(user_id,pen_name,is_approved) VALUES (?,'Chat author',1)",
        [author],
      );
      authorId = a.insertId;
      tier = (
        await (
          await import("../src/services/membership.service")
        ).saveTier(author, 1, {
          name: "Chat members",
          benefits: ["Private chat"],
        })
      ).tier!.id;
      grant = await membership(member);
      app.use(express.json());
      app.use((await import("../src/routes")).default);
      app.use(
        (
          e: { status?: number; message: string },
          _q: express.Request,
          r: express.Response,
          _n: express.NextFunction,
        ) => r.status(e.status ?? 500).json({ message: e.message }),
      );
      server = createServer(app);
      hub = (await import("../src/chat/chat.socket")).attachChat(server);
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
      memberToken = (await sessions.issueSession(member)).accessToken;
      authorToken = (await sessions.issueSession(author)).accessToken;
    }, 30000);
    afterAll(async () => {
      sockets.forEach((s) => s.disconnect());
      await new Promise<void>((resolve) => hub?.close(() => resolve()));
      await pool?.end();
      await redis?.closeRedis();
    });
    it("creates exactly one conversation under reader/author races and rejects nonmembers and arbitrary participants", async () => {
      const results = await Promise.all([
        chat.createConversation(member, { authorId }),
        chat.createConversation(author, { authorId, memberId: member }),
      ]);
      conversation = results[0].id;
      expect(results[1].id).toBe(conversation);
      await expect(
        chat.createConversation(outsider, { authorId }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        chat.createConversation(admin, { authorId }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        chat.createConversation(member, { authorId, memberId: outsider }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        chat.messageHistory(admin, conversation),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        chat.messageHistory(outsider, conversation),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("serializes simultaneous first creation from both participants without foreign-key lock deadlocks", async () => {
      for (let i = 0; i < 12; i++) {
        const reader = await user("READER");
        await membership(reader);
        const result = await Promise.allSettled([
          chat.createConversation(reader, { authorId }),
          chat.createConversation(author, { authorId, memberId: reader }),
        ]);
        const rejected = result
          .filter((r) => r.status === "rejected")
          .map((r) => String((r as PromiseRejectedResult).reason));
        expect(rejected).toEqual([]);
        const ids = result
          .filter((r) => r.status === "fulfilled")
          .map((r) => (r as PromiseFulfilledResult<{ id: number }>).value.id);
        expect(new Set(ids).size).toBe(1);
      }
    });
    it("requires valid token identity and trusted Origin on real websocket handshakes", async () => {
      await expect(connect(member, "forged")).rejects.toThrow();
      await expect(connect(author, memberToken)).rejects.toThrow();
      await expect(
        connect(member, memberToken, "https://untrusted.example"),
      ).rejects.toThrow();
      memberSocket = await connect(member, memberToken);
      authorSocket = await connect(author, authorToken);
      expect(
        (
          await memberSocket
            .timeout(5000)
            .emitWithAck("chat:join", conversation)
        ).ok,
      ).toBe(true);
      expect(
        (
          await authorSocket
            .timeout(5000)
            .emitWithAck("chat:join", conversation)
        ).ok,
      ).toBe(true);
    });
    it("persists and delivers real-time messages without treating HTML as markup", async () => {
      const delivered = event<{ text: string; id: number }>(
        authorSocket,
        "chat:message",
      );
      const saved = await chat.sendMessage(member, conversation, {
        clientId: randomUUID(),
        text: "Hello author <script>alert(1)</script>",
      });
      expect((await delivered).id).toBe(saved.id);
      const history = await chat.messageHistory(author, conversation);
      expect(history.items.at(-1)?.text).toBe(saved.text);
      expect(
        (await chat.listConversations(author)).items.find(
          (c) => c.id === conversation,
        )!.unread,
      ).toBe(1);
      await chat.markRead(author, conversation, { messageId: saved.id });
      expect(
        (await chat.listConversations(author)).items.find(
          (c) => c.id === conversation,
        )!.unread,
      ).toBe(0);
    });
    it("serializes concurrent message retries on one database connection and rejects conflicting IDs", async () => {
      const clientId = randomUUID();
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          chat.sendMessage(member, conversation, {
            clientId,
            text: "One persisted message",
          }),
        ),
      );
      expect(new Set(results.map((r) => r.id)).size).toBe(1);
      await expect(
        chat.sendMessage(member, conversation, {
          clientId,
          text: "Changed body",
        }),
      ).rejects.toMatchObject({ status: 409 });
      const [count] = await pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS count FROM member_messages WHERE sender_user_id=? AND client_id=?",
        [member, clientId],
      );
      expect(Number(count[0].count)).toBe(1);
    });
    it("paginates stable message IDs and validates monotonic read-state scope", async () => {
      const values = Array.from({ length: 55 }, (_, i) => [
        conversation,
        member,
        randomUUID(),
        "fixture-hash",
        `Older history ${i}`,
      ]);
      await pool.query(
        "INSERT INTO member_messages(conversation_id,sender_user_id,client_id,payload_hash,body) VALUES ?",
        [values],
      );
      const latest = await chat.messageHistory(author, conversation);
      expect(latest.items).toHaveLength(50);
      expect(latest.nextCursor).not.toBeNull();
      const older = await chat.messageHistory(
        author,
        conversation,
        latest.nextCursor,
      );
      expect(older.items.length).toBeGreaterThan(0);
      expect(older.items.at(-1)!.id).toBeLessThan(latest.items[0].id);
      await chat.markRead(author, conversation, {
        messageId: latest.items.at(-1)!.id,
      });
      await chat.markRead(author, conversation, {
        messageId: older.items[0].id,
      });
      expect(
        (await chat.listConversations(author)).items.find(
          (c) => c.id === conversation,
        )!.unread,
      ).toBe(0);
      await expect(
        chat.markRead(author, conversation, { messageId: 999999999 }),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("rejects expired sending, history, joining and stale live delivery; author retains history", async () => {
      await pool.query(
        "UPDATE memberships SET current_period_end=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE id=?",
        [grant],
      );
      await expect(
        chat.messageHistory(member, conversation),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        chat.sendMessage(member, conversation, {
          clientId: randomUUID(),
          text: "Expired",
        }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        chat.sendMessage(author, conversation, {
          clientId: randomUUID(),
          text: "Expired counterpart",
        }),
      ).rejects.toMatchObject({ status: 403 });
      expect((await chat.messageHistory(author, conversation)).canSend).toBe(
        false,
      );
      expect((await chat.listConversations(member)).items[0]).toMatchObject({
        canRead: false,
        canSend: false,
        unread: 0,
      });
      await new Promise((resolve) => setTimeout(resolve, 550));
      expect(
        (
          await memberSocket
            .timeout(5000)
            .emitWithAck("chat:join", conversation)
        ).status,
      ).toBe(403);
      let received = 0;
      const observe = () => {
        received++;
      };
      memberSocket.on("chat:message", observe);
      const revoked = event(memberSocket, "chat:revoked");
      const old = (await chat.messageHistory(author, conversation)).items.at(
        -1,
      )!;
      chat.chatEvents.emit("message", old);
      await revoked;
      expect(received).toBe(0);
      memberSocket.off("chat:message", observe);
      const reconnect = await connect(member, memberToken);
      expect(
        (await reconnect.timeout(5000).emitWithAck("chat:join", conversation))
          .status,
      ).toBe(403);
      reconnect.disconnect();
    });
    it("rejects invalid text and IDs without persisting and keeps read positions scoped", async () => {
      await expect(
        chat.sendMessage(member, conversation, {
          clientId: "invalid",
          text: "Valid text",
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        chat.sendMessage(member, conversation, {
          clientId: randomUUID(),
          text: " ",
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        chat.sendMessage(member, conversation, {
          clientId: randomUUID(),
          text: "x".repeat(4001),
        }),
      ).rejects.toMatchObject({ status: 400 });
      const reader = await user("READER");
      await membership(reader);
      const another = await chat.createConversation(reader, { authorId });
      const saved = await chat.sendMessage(reader, another.id, {
        clientId: randomUUID(),
        text: "Other conversation",
      });
      await expect(
        chat.markRead(author, conversation, { messageId: saved.id }),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("enforces bounded message rate and session revocation through HTTP/socket paths", async () => {
      const rateUser = await user("READER");
      await membership(rateUser);
      const own = await chat.createConversation(rateUser, { authorId });
      for (let i = 0; i < 30; i++)
        await chat.sendMessage(rateUser, own.id, {
          clientId: randomUUID(),
          text: `Bounded message ${i}`,
        });
      await expect(
        chat.sendMessage(rateUser, own.id, {
          clientId: randomUUID(),
          text: "Over limit",
        }),
      ).rejects.toMatchObject({ status: 429 });
      expect(
        (await request(app).get("/v1/api/chat/conversations")).status,
      ).toBe(401);
      const outsiderToken = (await sessions.issueSession(outsider)).accessToken;
      expect(
        (
          await request(app)
            .get(`/v1/api/chat/conversations/${conversation}/messages`)
            .set({
              "x-client-id": String(outsider),
              Authorization: `Bearer ${outsiderToken}`,
            })
        ).status,
      ).toBe(404);
      await pool.query(
        "UPDATE memberships SET current_period_end=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE id=?",
        [grant],
      );
      await pool.query(
        "UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=?",
        [member],
      );
      await new Promise((resolve) => setTimeout(resolve, 550));
      expect(
        (
          await memberSocket
            .timeout(5000)
            .emitWithAck("chat:join", conversation)
        ).status,
      ).toBe(401);
    });
  },
);
