import type { ReactNode } from "react";
import { useAuth } from "./AuthContext.js";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading, error, login } = useAuth();

  if (isLoading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Authentication Error</h2>
        <p>{error}</p>
        <button type="button" onClick={() => login()}>
          Try again
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>OpenClaw Control Plane</h2>
        <p>Sign in to manage your AI agents.</p>
        <button type="button" onClick={() => login()}>
          Sign in
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
