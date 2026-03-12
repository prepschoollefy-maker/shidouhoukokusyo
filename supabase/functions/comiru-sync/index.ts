/**
 * Supabase Edge Function: comiru-login
 * comiruにログインしてセッションcookieを返す（POST がCloudflareにブロックされるため Edge Function で実行）
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
};

function extractCookies(res: Response): string[] {
  const cookies: string[] = [];
  const raw = (res.headers as any).getSetCookie?.() || [];
  for (const c of raw) cookies.push(c.split(";")[0]);
  if (cookies.length === 0) {
    const h = res.headers.get("set-cookie") || "";
    for (const p of h.split(/,(?=\s*\w+=)/)) cookies.push(p.split(";")[0].trim());
  }
  return cookies.filter(Boolean);
}

function mergeCookies(jar: string[], newCookies: string[]): string[] {
  const map = new Map<string, string>();
  for (const c of [...jar, ...newCookies]) {
    const eq = c.indexOf("=");
    if (eq > 0) map.set(c.substring(0, eq), c);
  }
  return Array.from(map.values());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const comiruEmail = Deno.env.get("COMIRU_EMAIL");
    const comiruPassword = Deno.env.get("COMIRU_PASSWORD");

    if (!comiruEmail || !comiruPassword) {
      throw new Error("COMIRU_EMAIL/COMIRU_PASSWORD not set");
    }

    // GET login page
    const res1 = await fetch("https://comiru.jp/teachers/login", {
      headers: BROWSER_HEADERS,
      redirect: "manual",
    });

    let html: string;
    let jar = extractCookies(res1);
    jar.push("platform=Win32");

    if (res1.status >= 300 && res1.status < 400) {
      const location = res1.headers.get("location");
      if (location) {
        const url = location.startsWith("http") ? location : `https://comiru.jp${location}`;
        const res1b = await fetch(url, {
          headers: { ...BROWSER_HEADERS, Cookie: jar.join("; ") },
          redirect: "manual",
        });
        jar = mergeCookies(jar, extractCookies(res1b));
        html = await res1b.text();
      } else {
        html = await res1.text();
      }
    } else {
      html = await res1.text();
    }

    const csrfMatch = html.match(/name="_csrf_token"\s+value="([^"]+)"/);
    if (!csrfMatch) {
      throw new Error(`CSRFトークンが見つかりません (status: ${res1.status})`);
    }

    // POST login
    const body = new URLSearchParams({
      email: comiruEmail,
      password: comiruPassword,
      _csrf_token: csrfMatch[1],
    });
    const res2 = await fetch("https://comiru.jp/teachers/login", {
      method: "POST",
      headers: {
        ...BROWSER_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: jar.join("; "),
        Origin: "https://comiru.jp",
        Referer: "https://comiru.jp/teachers/login",
      },
      body: body.toString(),
      redirect: "manual",
    });

    if (res2.status !== 302) {
      throw new Error(`comiruログイン失敗 (status: ${res2.status})`);
    }

    jar = mergeCookies(jar, extractCookies(res2));

    // Access school top to establish session
    await fetch("https://comiru.jp/lefy/top", {
      headers: { ...BROWSER_HEADERS, Cookie: jar.join("; ") },
    });

    return new Response(
      JSON.stringify({ success: true, cookies: jar }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("comiru-login error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "comiruログインエラー" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
