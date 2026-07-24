import { NextResponse } from "next/server";
import pg from "pg";

export const dynamic = "force-dynamic";

const { Client } = pg;

const PG_CANDIDATES = [
  "SOURCE_DB_URL",
  "DATABASE_URL",
  "DIRECT_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "SUPABASE_DB_URL",
  "SUPABASE_DATABASE_URL",
];

function safeUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return {
      protocol: url.protocol,
      host: url.hostname,
      port: url.port || null,
      database: url.pathname.replace(/^\//, "") || null,
      user: url.username || null,
    };
  } catch {
    return { invalid: true };
  }
}

async function testPg(name: string, value: string) {
  const info = safeUrl(value);
  const client = new Client({
    connectionString: value,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    query_timeout: 8000,
  });
  try {
    await client.connect();
    const identity = await client.query(
      "select current_database() as database, current_user as user, now() as server_time",
    );
    const tables = await client.query(
      `select table_name
         from information_schema.tables
        where table_schema = 'public'
          and table_name in ('repartidores','turnos','pedidos','liquidaciones','orders','drivers','courier_shifts')
        order by table_name`,
    );
    const counts: Record<string, number | string> = {};
    for (const row of tables.rows) {
      const table = String(row.table_name);
      if (!/^[a-zA-Z0-9_]+$/.test(table)) continue;
      const result = await client.query(`select count(*)::bigint as count from public.${table}`);
      counts[table] = result.rows[0]?.count || "0";
    }
    return { name, configured: true, info, reachable: true, identity: identity.rows[0], counts };
  } catch (error) {
    return {
      name,
      configured: true,
      info,
      reachable: false,
      error: error instanceof Error ? error.message : "connection failed",
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function testRest() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) {
    return { configured: false, host: url ? safeUrl(url) : null, hasServiceKey: Boolean(service) };
  }
  try {
    const response = await fetch(`${url}/rest/v1/repartidores?select=id&limit=1`, {
      headers: { apikey: service, Authorization: `Bearer ${service}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    return {
      configured: true,
      host: safeUrl(url),
      hasServiceKey: true,
      reachable: true,
      status: response.status,
      body: (await response.text()).slice(0, 200),
    };
  } catch (error) {
    return {
      configured: true,
      host: safeUrl(url),
      hasServiceKey: true,
      reachable: false,
      error: error instanceof Error ? error.message : "fetch failed",
    };
  }
}

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const pgResults = [];
  for (const name of PG_CANDIDATES) {
    const value = process.env[name];
    if (value) pgResults.push(await testPg(name, value));
  }

  return NextResponse.json(
    {
      environment: process.env.VERCEL_ENV || "unknown",
      pg: pgResults,
      rest: await testRest(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
