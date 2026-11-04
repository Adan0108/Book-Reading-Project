import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import api from "../lib/axios";
import { message } from "../features/author/images";

interface Application {
  id: number;
  status: string;
  penName: string;
  decisionReason?: string;
  applicationTitle: string;
}
export default function AuthorApplicationPage() {
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api
      .get("/author-applications/me/latest")
      .then(({ data }) => {
        if (active) setApplication(data.metadata);
      })
      .catch((e: unknown) => {
        if (active && !(isAxiosError(e) && e.response?.status === 404))
          setError(message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api.post("/author-applications", data);
      const result = await api.get("/author-applications/me/latest");
      setApplication(result.data.metadata);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function withdraw() {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/author-applications/${application!.id}/withdraw`);
      setApplication({ ...application!, status: "WITHDRAWN" });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const active =
    application &&
    ["PENDING", "UNDER_REVIEW", "APPROVED"].includes(application.status);
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="max-w-2xl mx-auto p-6 space-y-5"
    >
      <Link to="/">← HiBook</Link>
      <h1 className="text-3xl font-bold">Become an author</h1>
      <p>
        Share a writing sample for review. Approval gives your account access to
        the writing studio.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading application…</p>
      ) : (
        <>
          {application && (
            <section
              className="border rounded-xl p-5 space-y-3"
              aria-label="Application status"
            >
              <h2 className="font-semibold">{application.applicationTitle}</h2>
              <p role="status">Status: {application.status}</p>
              {application.decisionReason && (
                <p>{application.decisionReason}</p>
              )}
              {application.status === "APPROVED" ? (
                <Link to="/author/dashboard" className="btn btn-primary">
                  Open writing studio
                </Link>
              ) : (
                active && (
                  <button className="btn" disabled={busy} onClick={withdraw}>
                    Withdraw application
                  </button>
                )
              )}
            </section>
          )}
          {!active && (
            <form onSubmit={submit} className="space-y-5">
              <fieldset disabled={busy} className="space-y-4">
                <label className="block">
                  Pen name
                  <input
                    className="input input-bordered w-full"
                    name="penName"
                    required
                    maxLength={100}
                  />
                </label>
                <label className="block">
                  Application title
                  <input
                    className="input input-bordered w-full"
                    name="applicationTitle"
                    required
                    minLength={5}
                    maxLength={150}
                  />
                </label>
                <label className="block">
                  Sample title
                  <input
                    className="input input-bordered w-full"
                    name="sampleTitle"
                    required
                    minLength={3}
                    maxLength={150}
                  />
                </label>
                <label className="block">
                  Writing sample
                  <textarea
                    className="textarea textarea-bordered w-full min-h-64"
                    name="sampleStory"
                    required
                    minLength={800}
                    maxLength={50000}
                  />
                  <span className="text-sm">
                    At least 800 characters. Please use your own writing.
                  </span>
                </label>
                <label className="block">
                  About your work
                  <textarea
                    className="textarea textarea-bordered w-full"
                    name="motivation"
                    maxLength={2000}
                  />
                </label>
                <button className="btn btn-primary" type="submit">
                  {busy ? "Submitting…" : "Submit application"}
                </button>
              </fieldset>
            </form>
          )}
        </>
      )}
    </main>
  );
}
