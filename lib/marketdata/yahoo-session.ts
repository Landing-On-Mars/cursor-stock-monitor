import "server-only";

const yahooHeaders = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Northstar/1.0",
};

type YahooSession = {
  cookie: string;
  crumb: string;
  fetchedAt: number;
};

let session: YahooSession | null = null;

export function yahooRequestHeaders() {
  return yahooHeaders;
}

export function clearYahooSession() {
  session = null;
}

export async function getYahooSession(): Promise<YahooSession> {
  if (session && Date.now() - session.fetchedAt < 50 * 60 * 1000) return session;

  const cookieResponse = await fetch("https://fc.yahoo.com/", {
    headers: yahooHeaders,
    redirect: "manual",
    signal: AbortSignal.timeout(8_000),
  });
  const cookie = cookieHeader(cookieResponse);
  if (!cookie) throw new Error("Yahoo cookie missing");

  const crumbResponse = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...yahooHeaders, Cookie: cookie },
    signal: AbortSignal.timeout(8_000),
  });
  const crumb = (await crumbResponse.text()).trim().replace(/^"+|"+$/g, "");
  if (!crumb || crumb.startsWith("{") || /unauthorized|invalid/i.test(crumb)) {
    throw new Error("Yahoo crumb missing");
  }

  session = { cookie, crumb, fetchedAt: Date.now() };
  return session;
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
