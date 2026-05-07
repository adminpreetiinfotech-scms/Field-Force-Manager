export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function authHeaders() {
  const phone = localStorage.getItem("sa_phone") ?? "";
  return { "Content-Type": "application/json", "x-admin-phone": phone };
}

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ title: "Request failed" }));
    throw new Error(err.title ?? "Request failed");
  }
  return res.json();
}
