/** What every data client shares: the network call and the parsing boundary. */

/** A request that has not finished by then is given up. */
export const FETCH_TIMEOUT_MS = 30_000;

/** A parsed answer, or why there is none. */
export type Result<T> =
  { readonly ok: true; readonly reading: T } | { readonly ok: false; readonly reason: string };

/** Thrown inside a parser for a bad answer; caught at the boundary, never escapes. */
export class Invalid extends Error {}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Runs a parser that throws {@link Invalid}, as a function that never throws. */
export function safely<T>(parse: () => T): Result<T> {
  try {
    return { ok: true, reading: parse() };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, reason: error.message };
    return { ok: false, reason: "unexpected parser error" };
  }
}

/**
 * Fetches `url` and hands its JSON body to `parse`. Every failure becomes
 * `{ ok: false, reason }`: "network error", "timeout", "HTTP <status>", "answer too
 * large", "not JSON", or the parser's reason. "aborted" means the caller cancelled
 * (the area changed, the tab was hidden), so it must not be shown as an outage. No
 * credentials and no referrer are sent.
 */
export async function fetchJson<T>(
  url: string,
  maxChars: number,
  parse: (body: unknown) => Result<T>,
  fetchFn: typeof fetch,
  signal?: AbortSignal,
): Promise<Result<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  const cancel = (): void => {
    controller.abort();
  };
  signal?.addEventListener("abort", cancel);
  if (signal?.aborted) controller.abort();
  const failed = (reason: string): Result<T> => ({
    ok: false,
    reason: signal?.aborted ? "aborted" : reason,
  });
  try {
    let response: Response;
    try {
      response = await fetchFn(url, {
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
    } catch {
      return failed(controller.signal.aborted ? "timeout" : "network error");
    }
    if (!response.ok) return failed(`HTTP ${String(response.status)}`);
    let text: string;
    try {
      text = await response.text();
    } catch {
      return failed(controller.signal.aborted ? "timeout" : "network error");
    }
    if (text.length > maxChars) return failed("answer too large");
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return failed("not JSON");
    }
    return signal?.aborted ? failed("aborted") : parse(body);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
