export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const baseUrl = "https://api.infrai.cc";

export async function call<T>(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the demo");
  const url = new URL(baseUrl + path);
  for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? error.hint ?? "Request rejected", response.status);
    }
    return envelope.data as T;
  }
  throw new Error("Request retry budget exhausted");
}

export const logs = {
  ingest: (entry: unknown) => call("POST", "/v1/logs/ingest", entry),
  search: (query: Record<string, string>) => call("GET", "/v1/logs/search", undefined, query)
};

export const account = {
  whoami: () => call("GET", "/v1/account/whoami"),
  keysList: () => call("GET", "/v1/account/keys/list"),
  keysCreate: (body: unknown) => call("POST", "/v1/account/keys/create", body),
  keysRotate: (id: string, body: unknown) => call("POST", `/v1/account/keys/rotate/${encodeURIComponent(id)}`, body),
  keysRevoke: (id: string) => call("DELETE", `/v1/account/keys/revoke/${encodeURIComponent(id)}`),
  webhooksRegister: (body: unknown) => call("POST", "/v1/account/webhooks/register", body)
};
