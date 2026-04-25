import type { ReactNode } from "react";
import { useAuth } from "./AuthContext.js";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading, error, login } = useAuth();

  if (isLoading) {
    return <div className="p-8 text-center text-gray-600">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Authentication Error
        </h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => login()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            OpenClaw Control Plane
          </h2>
          <p className="text-gray-600 mb-6">
            Sign in to manage your AI agents.
          </p>
          <button
            type="button"
            onClick={() => login()}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-2 focus:outline-offset-2 focus:outline-blue-600 transition-colors cursor-pointer"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
