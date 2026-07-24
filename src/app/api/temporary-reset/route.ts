import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await fetch(
    "https://muikwpjyaojeolwcuvqf.supabase.co/functions/v1/temporary-admin-repair",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-repair-key": "_ueMlFj47fM1YvOsWstp_iOwkPwvAVvBKxJ4g6qNoEI",
      },
      cache: "no-store",
    },
  );

  const body = await response.json().catch(() => ({ error: "Respuesta inválida" }));
  return NextResponse.json(body, {
    status: response.status,
    headers: { "Cache-Control": "no-store" },
  });
}
