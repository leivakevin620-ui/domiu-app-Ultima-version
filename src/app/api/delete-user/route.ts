import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ACTIVE_SUPABASE_URL = "https://muikwpjyaojeolwcuvqf.supabase.co";
const ACTIVE_ANON_KEY = "sb_publishable_Kcd-ANNCG6ZZhmQhH3jsTA_hqGXOCqO";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

    const token = (await cookies()).get("domiu-access-token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Tu sesión administrativa venció. Vuelve a iniciar sesión." }, { status: 401 });
    }

    const response = await fetch(`${ACTIVE_SUPABASE_URL}/functions/v1/legacy-user-admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ACTIVE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "delete", userId }),
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({ error: "Respuesta administrativa inválida" }));
    return NextResponse.json(body, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudo eliminar el usuario" }, { status: 500 });
  }
}
