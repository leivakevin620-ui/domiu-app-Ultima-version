import { NextResponse } from "next/server";
import { getPushPublicConfig } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getPushPublicConfig();
  return NextResponse.json(
    {
      enabled: config.enabled,
      publicKey: config.publicKey,
      missing: config.missing,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
