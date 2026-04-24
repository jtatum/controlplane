import { userManager } from "../auth/config.js";

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const user = await userManager.getUser();
  const headers = new Headers(init?.headers);
  if (user?.access_token) {
    headers.set("Authorization", `Bearer ${user.access_token}`);
  }
  headers.set("Accept", "application/json");

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
