import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Full browser fingerprint — mimics Chrome 120 on Windows
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Parse all Set-Cookie headers into a single "name=value; name2=value2" string.
 * Works across Deno versions: tries getSetCookie() (newer API) then falls back
 * to get("set-cookie") which some runtimes collapse into one comma-separated value.
 */
function extractCookies(headers: Headers): string {
  // Modern Deno / Fetch spec API
  const multi: string[] | undefined =
    typeof (headers as any).getSetCookie === "function"
      ? (headers as any).getSetCookie()
      : undefined;

  if (multi && multi.length > 0) {
    return multi.map((c: string) => c.split(";")[0]).join("; ");
  }

  // Fallback: older runtimes join multiple Set-Cookie into one header with ", "
  const raw = headers.get("set-cookie") ?? "";
  if (!raw) return "";

  // A cookie value can contain commas, but the separator between cookies in the
  // collapsed form is ", " followed by a token (name). We split conservatively.
  return raw
    .split(/,(?=\s*[\w-]+=)/)
    .map((c) => c.split(";")[0].trim())
    .join("; ");
}

/**
 * Step 1 – Visit sportybet.com/gh/ and return whatever tracking cookies the
 * server sets (locale, country, visitorId, _ga, etc.) without logging in.
 * These cookies are enough to authenticate the share/query endpoint.
 */
async function getTrackingCookies(): Promise<string> {
  try {
    const res = await fetch("https://www.sportybet.com/gh/", {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });

    const cookies = extractCookies(res.headers);
    console.log(
      "[sportybet-proxy] Tracking cookies acquired:",
      cookies.slice(0, 300)
    );
    return cookies;
  } catch (err) {
    console.warn("[sportybet-proxy] Could not fetch tracking cookies:", err);
    return "";
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { shareCode } = await req.json();

    if (!shareCode || typeof shareCode !== "string") {
      return new Response(
        JSON.stringify({ error: "shareCode is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cleanCode = shareCode.replace(/\s/g, "").toUpperCase();
    console.log("[sportybet-proxy] Querying code:", cleanCode);

    // ── Step 1: get unauthenticated tracking cookies ──────────────────────────
    const trackingCookies = await getTrackingCookies();

    // ── Step 2: query the share endpoint across multiple countries ────────────
    const timestamp = Date.now();
    const countries = ["gh", "ng", "ke", "zm", "tz"];
    let lastData: any = null;

    for (const country of countries) {
      const url = `https://www.sportybet.com/api/${country}/orders/share/${cleanCode}?_t=${timestamp}`;

      const apiHeaders: Record<string, string> = {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://www.sportybet.com",
        Referer: `https://www.sportybet.com/${country}/`,
        "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
      };

      if (trackingCookies) {
        apiHeaders["Cookie"] = trackingCookies;
      }

      let storedCookie = Deno.env.get("SPORTYBET_COOKIE")?.trim();
      if (storedCookie) {
        if (!storedCookie.includes("=")) {
          storedCookie = `accessToken=${storedCookie}`;
        }
        apiHeaders["Cookie"] = trackingCookies
          ? `${trackingCookies}; ${storedCookie}`
          : storedCookie;
      }

      try {
        const sbRes = await fetch(url, { method: "GET", headers: apiHeaders });
        if (!sbRes.ok) continue;

        const data = await sbRes.json();
        lastData = data;

        if (data.bizCode === 10000) {
          console.log(`[sportybet-proxy] Success with country: ${country}`);
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.warn(`[sportybet-proxy] Error querying ${country}:`, e);
      }
    }

    if (lastData) {
      console.log("[sportybet-proxy] All countries failed. Last bizCode:", lastData.bizCode);
      return new Response(JSON.stringify(lastData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Could not fetch from any Sportybet endpoint" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sportybet-proxy] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
