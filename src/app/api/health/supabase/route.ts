import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function safeHost(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return "invalid-url";
  }
}

async function testHealth(url: string, key?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      method: "GET",
      headers: key ? { apikey: key } : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const body = (await response.text()).slice(0, 160);
    return { reachable: true, ok: response.ok, status: response.status, body };
  } catch (error) {
    return {
      reachable: false,
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Unknown network error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const candidates = {
    configured: supabaseUrl ? await testHealth(supabaseUrl, anonKey) : null,
    legacyKnown: await testHealth("https://vuwaqmwgvldqmmgkpyjh.supabase.co"),
    currentConnected: await testHealth("https://muikwpjyaojeolwcuvqf.supabase.co"),
  };

  return NextResponse.json(
    {
      configuredHost: safeHost(supabaseUrl),
      hasPublicKey: Boolean(anonKey),
      hasServiceKey: Boolean(serviceKey),
      candidates,
    },
    { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
