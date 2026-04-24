import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { userManager } from "./config.js";

export function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    userManager
      .signinRedirectCallback()
      .then(() => navigate("/", { replace: true }))
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Authentication callback failed",
        );
      });
  }, [navigate]);

  if (error) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Authentication Error</h2>
        <p>{error}</p>
        <a href="/">Return home</a>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <p>Completing sign in...</p>
    </div>
  );
}
