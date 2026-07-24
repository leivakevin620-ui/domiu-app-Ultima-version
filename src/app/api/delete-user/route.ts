import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const ACTIVE_SUPABASE_URL = "https://muikwpjyaojeolwcuvqf.supabase.co";
const ACTIVE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Im11aWt3cGp5YW9qZW9sd2N1dnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NDc5NjIsImV4cCI6MjEwMDIyMzk2Mn0.Ly8OUPkvy1HV2gCu-QDeXFVGegLGRzBYU-N19GeYyQc";

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
