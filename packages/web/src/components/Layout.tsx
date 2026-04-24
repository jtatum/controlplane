import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/AuthContext.js";

const navItems = [
  { to: "/", label: "Agents" },
] as const;

export function Layout() {
  const { user, logout } = useAuth();
  const displayName =
    user?.profile?.name ?? user?.profile?.email ?? "User";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav
        style={{
          width: 220,
          background: "#1a1a2e",
          color: "#eee",
          display: "flex",
          flexDirection: "column",
          padding: "1rem 0",
        }}
      >
        <div
          style={{
            padding: "0 1rem 1rem",
            borderBottom: "1px solid #333",
            fontWeight: 600,
            fontSize: "1.1rem",
          }}
        >
          OpenClaw
        </div>

        <div style={{ flex: 1, padding: "0.5rem 0" }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              style={({ isActive }) => ({
                display: "block",
                padding: "0.5rem 1rem",
                color: isActive ? "#fff" : "#aaa",
                background: isActive ? "#16213e" : "transparent",
                textDecoration: "none",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div
          style={{
            padding: "0.75rem 1rem",
            borderTop: "1px solid #333",
            fontSize: "0.85rem",
          }}
        >
          <div style={{ marginBottom: "0.5rem", color: "#ccc" }}>
            {displayName}
          </div>
          <button
            type="button"
            onClick={() => logout()}
            style={{
              background: "none",
              border: "1px solid #555",
              color: "#aaa",
              padding: "0.25rem 0.5rem",
              cursor: "pointer",
              borderRadius: 4,
              fontSize: "0.8rem",
            }}
          >
            Sign out
          </button>
        </div>
      </nav>

      <main style={{ flex: 1, padding: "1.5rem 2rem", background: "#f5f5f5" }}>
        <Outlet />
      </main>
    </div>
  );
}
