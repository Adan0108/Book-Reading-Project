import Markdown from "react-markdown";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../lib/axios";
import { useThemeStore } from "../store/useThemeStore";
import type { BookDetail, Chapter } from "../type/book";
import NovelContent from "../features/reader/NovelContent";
import { useReaderPreferences } from "../features/reader/useReaderPreferences";
import { message } from "../features/author/images";
import "../features/reader/reader.css";
import ReportContent from '../features/moderation/ReportContent';

interface Header {
  id: number;
  index: number;
  title: string;
  isLockedForCurrentUser?: boolean;
}
export default function ChapterReadingPage() {
  const { slug, chapterNo } = useParams(),
    navigate = useNavigate();
  const isDark = useThemeStore((s) => s.isDark);
  const { preferences, setPreferences } = useReaderPreferences(isDark);
  const [chapter, setChapter] = useState<Chapter | null>(null),
    [book, setBook] = useState<BookDetail | null>(null),
    [headers, setHeaders] = useState<Header[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(0),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setChapter(null);
    setHeaders([]);
    Promise.allSettled([
      api.get(`/books/${slug}/chapters/${chapterNo}`),
      api.get(`/books/${slug}`),
      api.get(`/books/${slug}/chapters`),
    ]).then(([content, detail, list]) => {
      if (!active) return;
      if (content.status === "fulfilled")
        setChapter(content.value.data.metadata);
      else setError(message(content.reason));
      if (detail.status === "fulfilled") setBook(detail.value.data.metadata);
      if (list.status === "fulfilled")
        setHeaders(list.value.data.metadata.items ?? []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [slug, chapterNo, retry]);
  useEffect(() => {
    if (!chapter) return;
    const key = "hibook.reader.progress.v1",
      identity = `${slug}:${chapterNo}`;
    let restored = 0;
    try {
      restored =
        JSON.parse(localStorage.getItem(key) || "{}")[identity]?.position ?? 0;
    } catch {
      /* Optional local preference. */
    }
    let timer: number | undefined;
    const frame = requestAnimationFrame(() =>
      window.scrollTo({
        top:
          Math.max(0, Math.min(1, restored)) *
          (document.documentElement.scrollHeight - window.innerHeight),
        behavior: "instant",
      }),
    );
    const update = () => {
      const distance =
        document.documentElement.scrollHeight - window.innerHeight;
      const position =
        distance > 0 ? Math.max(0, Math.min(1, window.scrollY / distance)) : 1;
      setProgress(position);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        try {
          const saved = JSON.parse(localStorage.getItem(key) || "{}");
          saved[identity] = { position, updatedAt: Date.now() };
          const bounded = Object.fromEntries(
            Object.entries(saved)
              .sort(
                (a, b) =>
                  Number((b[1] as { updatedAt: number }).updatedAt) -
                  Number((a[1] as { updatedAt: number }).updatedAt),
              )
              .slice(0, 50),
          );
          localStorage.setItem(key, JSON.stringify(bounded));
        } catch {
          /* Do not block reading when storage is full or disabled. */
        }
      }, 500);
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [chapter, slug, chapterNo]);
  const position = headers.findIndex((h) => h.index === chapter?.index),
    previous = position > 0 ? headers[position - 1] : null,
    next = position >= 0 ? headers[position + 1] : null;
  const chapterLink = (index: number) => `/comic/${slug}/chapters/${index}`;
  return (
    <main className="novel-reader" data-theme={preferences.theme}>
      <a href="#chapter-content" className="sr-only focus:not-sr-only">
        Skip to chapter
      </a>
      <nav className="reader-bar" aria-label="Reader controls">
        <div className="reader-bar-inner">
          <Link to={`/comic/${slug}`}>← {book?.title || "Book details"}</Link>
          <div className="reader-settings">
            <label>
              Text size{" "}
              <select
                aria-label="Text size"
                value={preferences.fontSize}
                onChange={(e) =>
                  setPreferences((p) => ({
                    ...p,
                    fontSize: Number(e.target.value),
                  }))
                }
              >
                {[16, 18, 20, 22, 24, 28].map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() =>
                setPreferences((p) => ({
                  ...p,
                  theme: p.theme === "dark" ? "light" : "dark",
                }))
              }
            >
              {preferences.theme === "dark"
                ? "Light reading theme"
                : "Dark reading theme"}
            </button>
            <span aria-label="Reading progress">
              {Math.round(progress * 100)}%
            </span>
          </div>
        </div>
        <div
          className="reading-progress"
          style={{ width: `${progress * 100}%` }}
        />
      </nav>
      {loading ? (
        <p role="status" className="p-12 text-center">
          Opening chapter…
        </p>
      ) : !chapter ? (
        <section className="p-12 text-center space-y-4">
          <h1 className="text-2xl font-bold">This chapter is unavailable</h1>
          <p role="alert">
            {error ||
              "It may require membership, sign-in or a later release date."}
          </p>
          <Link className="btn" to="/login">
            Sign in
          </Link>
          {book?.authorProfile?.id&&<Link className="btn btn-primary" to={`/author/${book.authorProfile.id}/memberships`}>View membership plans</Link>}
          <button className="btn" onClick={() => setRetry((v) => v + 1)}>
            Retry
          </button>
        </section>
      ) : (
        <>
          <div className="reader-chapters">
            <label>
              Chapter list{" "}
              <select
                aria-label="Chapter list"
                value={chapter.index}
                onChange={(e) => navigate(chapterLink(Number(e.target.value)))}
              >
                {headers.map((h) => (
                  <option key={h.id} value={h.index}>
                    {h.index}. {h.title}
                    {h.isLockedForCurrentUser ? " · Members" : ""}
                  </option>
                ))}
              </select>
            </label>
            <span>{headers.length} published chapters</span>
          </div>
          <article
            id="chapter-content"
            className="novel-prose"
            style={{ fontSize: preferences.fontSize }}
          >
            <header>
              <p>Chapter {chapter.index}</p>
              <h1>{chapter.title}</h1>
            </header>
            {chapter.contentDocument ? (
              <NovelContent
                document={chapter.contentDocument}
                images={chapter.images ?? []}
              />
            ) : (
              <>
                {chapter.images?.map((image, index) => (
                  <img
                    key={image.id}
                    src={image.imageUrl}
                    alt={`Page ${index + 1}`}
                    loading={index ? "lazy" : "eager"}
                  />
                ))}
                <Markdown>{chapter.contentMarkdown || ""}</Markdown>
              </>
            )}
            <nav className="reader-nav" aria-label="Chapter navigation">
              {previous ? (
                <Link to={chapterLink(previous.index)}>← Previous chapter</Link>
              ) : (
                <span>First chapter</span>
              )}
              {next ? (
                <Link to={chapterLink(next.index)}>Next chapter →</Link>
              ) : (
                <Link to={`/comic/${slug}`}>Back to book</Link>
              )}
            </nav>
            <ReportContent kind="CHAPTER" resourceId={chapter.id}/>
          </article>
        </>
      )}
    </main>
  );
}
