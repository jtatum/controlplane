import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/AuthContext.js";

const navItems = [
  { to: "/", label: "Agents" },
  { to: "/agents/new", label: "Create Agent" },
  { to: "/emails/review", label: "Email Review" },
] as const;

export function Layout() {
  const { user, logout } = useAuth();
  const displayName =
    user?.profile?.name ?? user?.profile?.email ?? "User";

  return (
    <div className="flex min-h-screen">
      <nav className="w-56 bg-slate-900 text-gray-200 flex flex-col py-4">
        <div className="px-4 pb-4 border-b border-slate-700 font-semibold text-lg">
          OpenClaw
        </div>

        <div className="flex-1 py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `block px-4 py-2 transition-colors ${
                  isActive
                    ? "text-white bg-slate-800 border-r-2 border-blue-400 font-medium"
                    : "text-gray-400 hover:text-white hover:bg-slate-800/50"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="px-4 pt-3 border-t border-slate-700 text-sm">
          <div className="mb-2 text-gray-300">{displayName}</div>
          <button
            type="button"
            onClick={() => logout()}
            className="border border-slate-600 text-gray-400 px-2 py-1 rounded text-xs hover:text-white hover:border-slate-500 transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="flex-1 p-6 bg-gray-50 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
