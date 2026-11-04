import { NavLink } from "react-router-dom";
const links = [
  ["/author/dashboard", "My books"],
  ["/author/memberships", "Memberships"],
  ["/author/posts", "Author posts"],
  ["/author/payments", "Income"],
  ["/account/messages", "Messages"],
  ["/author/profile", "Public profile"],
];
export default function AuthorNavigation() {
  return (
    <nav
      aria-label="Writing workspace"
      className="flex flex-wrap gap-2 border-b border-base-300 pb-4"
    >
      {links.map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `btn btn-sm ${isActive ? "btn-primary" : "btn-ghost"}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
