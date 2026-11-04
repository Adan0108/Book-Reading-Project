import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { useThemeStore } from "../../store/useThemeStore";
export default function Header() {
  const user = useAuthStore((s) => s.authUser),
    fetchMe = useAuthStore((s) => s.fetchMe),
    logout = useAuthStore((s) => s.logout),
    { isDark, toggleTheme } = useThemeStore(),
    navigate = useNavigate(),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (localStorage.getItem("userId")) void fetchMe();
  }, [fetchMe]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menu.current) menu.current.open = false;
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  function close() {
    if (menu.current) menu.current.open = false;
  }
  return (
    <header className="bg-base-100 border-b border-base-300">
      <a className="sr-only focus:not-sr-only" href="#main-content">
        Skip to content
      </a>
      <div className="mx-auto max-w-7xl px-4 py-4 flex flex-wrap items-center gap-4">
        <Link
          to="/"
          className="font-bold text-2xl text-primary"
          aria-label="HiBook home"
        >
          HiBook
        </Link>
        <nav aria-label="Main navigation" className="flex gap-4 text-sm">
          <Link to="/">Browse</Link>
          {user?.id && (
            <>
              <Link to="/account/library">Library</Link>
              <Link to="/account/messages">Messages</Link>
            </>
          )}
        </nav>
        <form
          role="search"
          aria-label="Site search"
          className="flex gap-2 flex-1 min-w-44 max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/?query=${encodeURIComponent(query)}`);
          }}
        >
          <input
            aria-label="Search stories"
            className="input input-bordered input-sm w-full"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title or author"
          />
          <button className="btn btn-sm" type="submit">
            Search
          </button>
        </form>
        <button
          className="btn btn-ghost btn-sm"
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          onClick={toggleTheme}
        >
          {isDark ? "Light" : "Dark"}
        </button>
        {user?.id ? (
          <details ref={menu} className="dropdown dropdown-end">
            <summary className="btn btn-sm max-w-52 truncate">
              {user.username || "My account"}
            </summary>
            <ul
              className="menu dropdown-content bg-base-100 rounded-box shadow-xl border border-base-300 z-50 w-60 mt-3"
              onClick={close}
            >
              <li>
                <Link to="/account/profile">Profile</Link>
              </li>
              <li>
                <Link to="/account/library">My library</Link>
              </li>
              <li>
                <Link to="/account/memberships">My memberships</Link>
              </li>
              <li>
                <Link to="/account/payments">Payment history</Link>
              </li>
              {user.roles?.includes("AUTHOR") && (
                <>
                  <li>
                    <Link to="/author/dashboard">Writing studio</Link>
                  </li>
                  <li>
                    <Link to="/author/profile">Author profile settings</Link>
                  </li>
                  <li>
                    <Link to="/author/memberships">Manage memberships</Link>
                  </li>
                </>
              )}
              {user.roles?.includes("ADMIN") && (
                <li>
                  <Link to="/admin">Administration</Link>
                </li>
              )}
              <li>
                <Link to="/account/author-application">Author application</Link>
              </li>
              <li>
                <button
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void logout().finally(() => setBusy(false));
                  }}
                >
                  Sign out
                </button>
              </li>
            </ul>
          </details>
        ) : (
          <div className="flex gap-3">
            <Link className="btn btn-sm" to="/login">
              Sign in
            </Link>
            <Link className="btn btn-primary btn-sm" to="/signUp">
              Join HiBook
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
