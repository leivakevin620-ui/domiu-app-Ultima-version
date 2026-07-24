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

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result: Record<string, unknown> = {
    configuredHost: safeHost(supabaseUrl),
    hasPublicKey: Boolean(anonKey),
    hasServiceKey: Boolean(serviceKey),
    authHealth: null,
  };

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { ...result, error: "Supabase no está configurado completamente en Vercel" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: anonKey },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const body = (await response.text()).slice(0, 240);
    result.authHealth = {
      reachable: true,
      ok: response.ok,
      status: response.status,
      body,
    };
  } catch (error) {
    result.authHealth = {
      reachable: false,
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Unknown network error",
    };
  }

  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
