import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "oidc-client-ts";
import { userManager } from "./config.js";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";

const DEV_USER = {
  access_token: "dev-token",
  token_type: "Bearer",
  expired: false,
  profile: {
    sub: "dev-user-001",
    email: "dev@openclaw.local",
    name: "Dev User",
  },
} as unknown as User;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(DEV_MODE ? DEV_USER : null);
  const [isLoading, setIsLoading] = useState(!DEV_MODE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (DEV_MODE) return;

    userManager
      .getUser()
      .then((u) => {
        if (u && !u.expired) {
          setUser(u);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load session");
      })
      .finally(() => setIsLoading(false));

    const onUserLoaded = (u: User) => setUser(u);
    const onUserUnloaded = () => setUser(null);

    userManager.events.addUserLoaded(onUserLoaded);
    userManager.events.addUserUnloaded(onUserUnloaded);

    return () => {
      userManager.events.removeUserLoaded(onUserLoaded);
      userManager.events.removeUserUnloaded(onUserUnloaded);
    };
  }, []);

  const login = useCallback(async () => {
    if (DEV_MODE) return;
    await userManager.signinRedirect();
  }, []);

  const logout = useCallback(async () => {
    if (DEV_MODE) {
      setUser(null);
      return;
    }
    await userManager.signoutRedirect();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
