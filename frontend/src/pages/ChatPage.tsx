import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../lib/axios";
import { useAuthStore } from "../store/useAuthStore";
import { message } from "../features/author/images";
import { useChatConnection } from "../features/chat/useChatConnection";
import type { ChatMessage, Conversation } from "../features/chat/types";

function merge(a: ChatMessage[], b: ChatMessage[]) {
  return [...new Map([...a, ...b].map((m) => [m.id, m])).values()].sort(
    (a, b) => a.id - b.id,
  );
}
export default function ChatPage() {
  const [params, setParams] = useSearchParams(),
    userId = useAuthStore((s) => Number(s.authUser?.id));
  const [conversations, setConversations] = useState<Conversation[] | null>(
      null,
    ),
    [selected, setSelected] = useState<number | null>(null),
    [messages, setMessages] = useState<ChatMessage[]>([]),
    [cursor, setCursor] = useState<number | null>(null),
    [listCursor, setListCursor] = useState<number | null>(null),
    [canSend, setCanSend] = useState(false),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const selectedRef = useRef(selected),
    pending = useRef<{
      conversationId: number;
      text: string;
      clientId: string;
    } | null>(null),
    sending = useRef(false),
    end = useRef<HTMLDivElement>(null);
  const loadList = useCallback(async (cursor?: number) => {
    try {
      const { data } = await api.get("/chat/conversations", {
        params: cursor ? { cursor } : undefined,
      });
      setConversations((old) =>
        cursor ? [...(old ?? []), ...data.metadata.items] : data.metadata.items,
      );
      setListCursor(data.metadata.nextCursor);
    } catch (e) {
      setError(message(e));
    }
  }, []);
  const loadMessages = useCallback(async (id: number, before?: number) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/chat/conversations/${id}/messages`, {
        params: before ? { cursor: before } : undefined,
      });
      if (selectedRef.current !== id) return;
      setMessages((old) => merge(old, data.metadata.items));
      setCursor(data.metadata.nextCursor);
      setCanSend(data.metadata.canSend);
      setError("");
    } catch (e) {
      if (selectedRef.current === id) {
        setMessages([]);
        setCanSend(false);
        setError(message(e));
      }
    } finally {
      if (selectedRef.current === id) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    const authorId = params.get("author"),
      memberId = params.get("member");
    if (!authorId) return;
    let active = true;
    void api
      .post("/chat/conversations", {
        authorId: Number(authorId),
        ...(memberId ? { memberId: Number(memberId) } : {}),
      })
      .then(({ data }) => {
        if (active) {
          setSelected(data.metadata.id);
          setParams({}, { replace: true });
          void loadList();
        }
      })
      .catch((e: unknown) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [params, setParams, loadList]);
  useEffect(() => {
    selectedRef.current = selected;
    setMessages([]);
    setCursor(null);
    setCanSend(false);
    setText("");
    pending.current = null;
    if (selected) void loadMessages(selected);
  }, [selected, loadMessages]);
  const connection = useChatConnection(selected, {
    message: (m) => {
      if (m.conversationId === selectedRef.current)
        setMessages((old) => merge(old, [m]));
    },
    changed: () => void loadList(),
    revoked: (reason) => {
      setMessages([]);
      setCanSend(false);
      setError(reason);
      void loadList();
    },
    reconnected: () => {
      if (selectedRef.current) void loadMessages(selectedRef.current);
    },
  });
  const last = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!selected || !last) return;
    end.current?.scrollIntoView({ block: "nearest" });
    const mark = () => {
      if (document.visibilityState === "visible" && document.hasFocus())
        void api
          .post(`/chat/conversations/${selected}/read`, { messageId: last })
          .catch(() => {});
    };
    mark();
    window.addEventListener("focus", mark);
    document.addEventListener("visibilitychange", mark);
    return () => {
      window.removeEventListener("focus", mark);
      document.removeEventListener("visibilitychange", mark);
    };
  }, [selected, last]);
  async function send() {
    if (!selected || sending.current || !text.trim()) return;
    const id = selected,
      body = text.trim();
    if (
      !pending.current ||
      pending.current.conversationId !== id ||
      pending.current.text !== body
    )
      pending.current = {
        conversationId: id,
        text: body,
        clientId: crypto.randomUUID(),
      };
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/chat/conversations/${id}/messages`, {
        text: body,
        clientId: pending.current.clientId,
      });
      if (selectedRef.current === id) {
        setMessages((old) => merge(old, [data.metadata]));
        setText("");
        pending.current = null;
      }
      void loadList();
    } catch (e) {
      setError(message(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  const active = conversations?.find((c) => c.id === selected);
  const maySend = canSend && active?.canSend !== false;
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-base-200 p-4 md:p-8"
    >
      <div className="mx-auto max-w-6xl space-y-5">
        <nav className="flex flex-wrap gap-5">
          <Link to="/">← HiBook</Link>
          <Link to="/account/memberships">My memberships</Link>
        </nav>
        <h1 className="text-3xl font-bold">Member messages</h1>
        <p className="text-sm" role="status">
          {connection}
        </p>
        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}
        <div className="grid md:grid-cols-[18rem_minmax(0,1fr)] gap-5">
          <aside
            aria-label="Conversations"
            className={`card bg-base-100 p-4 space-y-3 ${selected ? "hidden md:block" : ""}`}
          >
            <h2 className="font-bold text-lg">Conversations</h2>
            {conversations === null ? (
              <p>Loading conversations…</p>
            ) : !conversations.length ? (
              <p>
                No conversations yet. Start a chat from an author profile or
                your member list.
              </p>
            ) : (
              conversations.map((c) => (
                <button
                  className={`btn w-full justify-start h-auto min-h-12 whitespace-normal ${selected === c.id ? "btn-primary" : "btn-ghost"}`}
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  aria-pressed={selected === c.id}
                >
                  <span>
                    {c.title}
                    {c.unread > 0 ? ` · ${c.unread} unread` : ""}
                    {!c.canSend ? " · Membership inactive" : ""}
                  </span>
                </button>
              ))
            )}
            {listCursor && (
              <button className="btn" onClick={() => void loadList(listCursor)}>
                Older conversations
              </button>
            )}
          </aside>
          <section
            aria-label="Conversation"
            className="card bg-base-100 p-4 md:p-6 min-w-0 space-y-4"
          >
            {!selected ? (
              <p>Select a conversation to read your messages.</p>
            ) : (
              <>
                <header className="flex gap-3 items-center">
                  <button
                    className="btn btn-sm md:hidden"
                    onClick={() => setSelected(null)}
                  >
                    Back to conversations
                  </button>
                  <h2 className="font-bold text-xl">
                    {active?.title ?? "Conversation"}
                  </h2>
                </header>
                <p className="text-sm">
                  Messages persist on the server. Members need an active
                  membership to read history or send. Authors retain their own
                  history.
                </p>
                {cursor && (
                  <button
                    className="btn btn-sm"
                    onClick={() => void loadMessages(selected, cursor)}
                  >
                    Older messages
                  </button>
                )}
                <div
                  role="log"
                  aria-label="Message history"
                  aria-live="polite"
                  className="overflow-y-auto max-h-[50dvh] min-h-40 space-y-4 p-1"
                >
                  {loading && !messages.length ? (
                    <p>Loading messages…</p>
                  ) : !messages.length ? (
                    <p>No messages to display.</p>
                  ) : (
                    messages.map((m) => (
                      <article
                        key={m.id}
                        className={`rounded-xl p-3 max-w-[90%] w-fit ${m.senderId === userId ? "ml-auto bg-primary text-primary-content" : "bg-base-200"}`}
                      >
                        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {m.text}
                        </p>
                        <p className="text-xs mt-2">
                          <time dateTime={m.createdAt}>
                            {new Date(m.createdAt).toLocaleString()}
                          </time>
                          {m.senderId === userId ? " · Sent" : ""}
                        </p>
                      </article>
                    ))
                  )}
                  <div ref={end} />
                </div>
                {!maySend && (
                  <p>
                    Sending requires an active membership between this reader
                    and author.
                  </p>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                  className="space-y-3"
                >
                  <label className="block">
                    Message
                    <textarea
                      className="textarea textarea-bordered w-full mt-2"
                      aria-label="Message"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      maxLength={4000}
                      rows={3}
                      disabled={!maySend || busy}
                    />
                  </label>
                  <button
                    className="btn btn-primary"
                    disabled={!maySend || busy || !text.trim()}
                  >
                    {busy ? "Sending…" : "Send message"}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
