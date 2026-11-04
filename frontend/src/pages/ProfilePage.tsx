import AuthorNavigation from "../features/author/AuthorNavigation";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApiResource } from "../lib/useApiResource";
import api from "../lib/axios";
import { message } from "../features/author/images";
import { useAuthStore } from "../store/useAuthStore";
interface Profile {
  id: number;
  email?: string;
  username?: string;
  nickname?: string;
  penName?: string;
  bio: string;
  isPrivate?: boolean;
}
export default function ProfilePage({ author = false }: { author?: boolean }) {
  const endpoint = author ? "/authors/me/profile" : "/user/me/profile",
    resource = useApiResource<Profile>(endpoint),
    [form, setForm] = useState({
      username: "",
      nickname: "",
      penName: "",
      bio: "",
      isPrivate: false,
    }),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (resource.data)
      setForm({
        username: resource.data.username ?? "",
        nickname: resource.data.nickname ?? "",
        penName: resource.data.penName ?? "",
        bio: resource.data.bio ?? "",
        isPrivate: resource.data.isPrivate ?? false,
      });
  }, [resource.data]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await api.patch(
        endpoint,
        author
          ? { penName: form.penName, bio: form.bio }
          : {
              username: form.username,
              nickname: form.nickname,
              bio: form.bio,
              isPrivate: form.isPrivate,
            },
      );
      await useAuthStore.getState().fetchMe();
      setStatus("Profile saved.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-base-200">
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-3xl mx-auto p-4 md:p-10 space-y-6"
      >
        {author && <AuthorNavigation />}
        <h1 className="text-3xl font-bold">
          {author ? "Author profile settings" : "Account profile"}
        </h1>
        <nav className="flex flex-wrap gap-4">
          <Link className="link" to="/account/library">
            My library
          </Link>
          {author && resource.data && (
            <Link className="link" to={`/author/${resource.data.id}`}>
              View public author profile
            </Link>
          )}
          <Link className="link" to="/forgot/email">
            Reset password
          </Link>
        </nav>
        {(error || resource.error) && (
          <p role="alert" className="alert alert-error">
            {error || resource.error}
          </p>
        )}
        {status && <p role="status">{status}</p>}
        {resource.loading ? (
          <p role="status">Loading profile…</p>
        ) : (
          resource.data && (
            <form
              className="card bg-base-100 p-6 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <fieldset disabled={busy} className="space-y-5">
                {author ? (
                  <label className="block">
                    Pen name
                    <input
                      aria-label="Pen name"
                      className="input input-bordered w-full mt-2"
                      required
                      maxLength={255}
                      value={form.penName}
                      onChange={(e) =>
                        setForm({ ...form, penName: e.target.value })
                      }
                    />
                  </label>
                ) : (
                  <>
                    <label className="block">
                      Email address
                      <input
                        aria-label="Email address"
                        className="input input-bordered w-full mt-2"
                        readOnly
                        value={resource.data.email ?? ""}
                      />
                    </label>
                    <label className="block">
                      Username
                      <input
                        aria-label="Username"
                        className="input input-bordered w-full mt-2"
                        required
                        maxLength={50}
                        value={form.username}
                        onChange={(e) =>
                          setForm({ ...form, username: e.target.value })
                        }
                      />
                    </label>
                    <label className="block">
                      Display name
                      <input
                        aria-label="Display name"
                        className="input input-bordered w-full mt-2"
                        maxLength={100}
                        value={form.nickname}
                        onChange={(e) =>
                          setForm({ ...form, nickname: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                <label className="block">
                  {author ? "Public author biography" : "Account biography"}
                  <textarea
                    aria-label={
                      author ? "Public author biography" : "Account biography"
                    }
                    className="textarea textarea-bordered w-full mt-2"
                    rows={7}
                    maxLength={5000}
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  />
                </label>
                {!author && (
                  <>
                    <label className="flex gap-3 items-center">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={form.isPrivate}
                        onChange={(e) =>
                          setForm({ ...form, isPrivate: e.target.checked })
                        }
                      />
                      Keep account profile private
                    </label>
                    <p className="text-sm">
                      Your account biography is separate from your public author
                      biography.
                    </p>
                  </>
                )}
                <button className="btn btn-primary" disabled={busy}>
                  {busy ? "Saving…" : "Save profile"}
                </button>
              </fieldset>
            </form>
          )
        )}
        <button className="btn" onClick={resource.reload}>
          Reload profile
        </button>
      </main>
    </div>
  );
}
