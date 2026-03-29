import { QueryClient, QueryFunction } from "@tanstack/react-query";

function toRelative(url: string): string {
  return url.startsWith("/") ? "." + url : url;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/** In-memory session key — set by SessionKeyContext, read here. Never persisted. */
let _sessionKey: string | null = null;
export function setSessionKey(k: string | null) { _sessionKey = k; }
export function getSessionKey(): string | null { return _sessionKey; }

function sessionHeaders(): Record<string, string> {
  return _sessionKey ? { "X-Api-Key": _sessionKey } : {};
}

export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const res = await fetch(toRelative(url), {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...sessionHeaders(),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401 }) => async ({ queryKey }) => {
    const res = await fetch(toRelative(queryKey.join("/")), {
      headers: sessionHeaders(),
    });
    if (on401 === "returnNull" && res.status === 401) return null;
    await throwIfResNotOk(res);
    return res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: { retry: false },
  },
});
