import { userManager } from "../auth/config.js";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";

export async function authFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  if (!DEV_MODE) {
    const user = await userManager.getUser();
    if (user?.access_token) {
      headers.set("Authorization", `Bearer ${user.access_token}`);
    }
  }

  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
  return res;
}

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await authFetch(path);
  return res.json() as Promise<T>;
}
