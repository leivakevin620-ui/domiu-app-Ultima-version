import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ACTIVE_SUPABASE_URL = "https://muikwpjyaojeolwcuvqf.supabase.co";
const ACTIVE_ANON_KEY = "sb_publishable_Kcd-ANNCG6ZZhmQhH3jsTA_hqGXOCqO";

async function callUserAdmin(payload: Record<string, unknown>) {
  const token = (await cookies()).get("domiu-access-token")?.value;
  if (!token) {
    return NextResponse.json(
      { error: "Tu sesión administrativa venció. Vuelve a iniciar sesión." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const response = await fetch(`${ACTIVE_SUPABASE_URL}/functions/v1/legacy-user-admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ACTIVE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({ error: "Respuesta administrativa inválida" }));
    return NextResponse.json(body, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No fue posible contactar el servicio administrativo" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET() {
  return callUserAdmin({ action: "list" });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return callUserAdmin(body);
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
}
