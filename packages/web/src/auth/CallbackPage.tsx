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
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Error</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <a href="/" className="text-blue-600 hover:underline">Return home</a>
      </div>
    );
  }

  return (
    <div className="p-8 text-center">
      <p className="text-gray-600">Completing sign in...</p>
    </div>
  );
}
