import type { ReactNode } from "react";
import { Link } from "react-router-dom";
export default function AdminLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-base-200 p-4 md:p-8"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <Link to="/">← HiBook</Link>
        <h1 className="text-3xl font-bold">{title}</h1>
        <nav
          aria-label="Administration"
          className="flex flex-wrap gap-4 text-sm"
        >
          <Link className="link" to="/admin">
            Dashboard
          </Link>
          <Link className="link" to="/admin/users">
            Accounts
          </Link>
          <Link className="link" to="/admin/users?role=AUTHOR">
            Authors
          </Link>
          <Link className="link" to="/admin/content">
            Content
          </Link>
          <Link className="link" to="/admin/reports">
            Reports
          </Link>
          <Link className="link" to="/admin/settings">
            Settings
          </Link>
          <Link className="link" to="/admin/membership-policy">
            Membership pricing
          </Link>
          <Link className="link" to="/admin/reconciliation">
            Billing review
          </Link>
          <Link className="link" to="/admin/audit">
            Audit trail
          </Link>
          <Link className="link" to="/admin/applications">
            Author applications
          </Link>
        </nav>
        {children}
      </div>
    </main>
  );
}
