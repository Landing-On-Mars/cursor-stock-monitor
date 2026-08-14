import "server-only";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const yahooHeaders = {
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent": BROWSER_UA,
};

const COOKIE_URLS = ["https://fc.yahoo.com/", "https://finance.yahoo.com/quote/AAPL"];
const CRUMB_URLS = [
  "https://query1.finance.yahoo.com/v1/test/getcrumb",
  "https://query2.finance.yahoo.com/v1/test/getcrumb",
];

type YahooSession = {
  cookie: string;
  crumb: string;
  fetchedAt: number;
};

let session: YahooSession | null = null;

export function yahooRequestHeaders() {
  return {
    ...yahooHeaders,
    Origin: "https://finance.yahoo.com",
    Referer: "https://finance.yahoo.com/",
  };
}

export function clearYahooSession() {
  session = null;
}

export async function getYahooSession(): Promise<YahooSession> {
  if (session && Date.now() - session.fetchedAt < 50 * 60 * 1000) return session;

  let lastError: unknown;
  for (const cookieUrl of COOKIE_URLS) {
    try {
      const cookie = await collectCookies(cookieUrl);
      if (!cookie) throw new Error("Yahoo cookie missing");
      const crumb = await fetchCrumb(cookie);
      session = { cookie, crumb, fetchedAt: Date.now() };
      return session;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Yahoo crumb missing");
}

async function collectCookies(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": BROWSER_UA,
    },
    redirect: "manual",
    signal: AbortSignal.timeout(8_000),
  });
  return cookieHeader(response);
}

async function fetchCrumb(cookie: string): Promise<string> {
  let lastError: unknown;
  for (const url of CRUMB_URLS) {
    try {
      const response = await fetch(url, {
        headers: {
          ...yahooRequestHeaders(),
          Accept: "text/plain",
          Cookie: cookie,
        },
        signal: AbortSignal.timeout(8_000),
      });
      const crumb = (await response.text()).trim().replace(/^"+|"+$/g, "");
      if (!response.ok) throw new Error(`Yahoo crumb returned ${response.status}`);
      if (!crumb || crumb.startsWith("{") || /unauthorized|invalid/i.test(crumb)) {
        throw new Error("Yahoo crumb missing");
      }
      return crumb;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Yahoo crumb missing");
}

function cookieHeader(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const listed = headers.getSetCookie?.() ?? [];
  const fallback = response.headers.get("set-cookie");
  const parts = listed.length > 0 ? listed : fallback ? [fallback] : [];
  return parts
    .map((part) => part.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}
