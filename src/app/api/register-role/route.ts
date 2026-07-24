import { NextResponse } from "next/server";
import { registerRoleUser } from "@/lib/server/register-role";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const result = await registerRoleUser(await request.json());
    return NextResponse.json(result.body, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Solicitud inválida" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
