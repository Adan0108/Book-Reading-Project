import type { ReactNode } from "react";
import { Link } from "react-router-dom";
export default function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-base-200 flex flex-col items-center justify-center px-4 py-12 gap-6"
    >
      <Link
        to="/"
        className="text-3xl font-bold text-primary"
        aria-label="HiBook home"
      >
        HiBook
      </Link>
      <section className="card bg-base-100 shadow-sm w-full max-w-md p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-2">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
