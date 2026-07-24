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
    connectionTimeoutMillis: 7000,
    query_timeout: 7000,
  });
  try {
    await client.connect();
    const tables = await client.query(
      `select table_name from information_schema.tables
        where table_schema='public'
          and table_name in ('repartidores','turnos','pedidos','liquidaciones','orders','drivers','courier_shifts')
        order by table_name`,
    );
    const counts: Record<string, string> = {};
    for (const row of tables.rows) {
      const table = String(row.table_name);
      if (!/^[a-zA-Z0-9_]+$/.test(table)) continue;
      const result = await client.query(`select count(*)::bigint as count from public.${table}`);
      counts[table] = String(result.rows[0]?.count || "0");
    }
    return { name, configured: true, info, reachable: true, counts };
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
  if (!url || !service) return { configured: false, host: safeUrl(url), hasServiceKey: Boolean(service) };
  try {
    const response = await fetch(`${url}/rest/v1/repartidores?select=id&limit=1`, {
      headers: { apikey: service, Authorization: `Bearer ${service}` },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    return {
      configured: true,
      host: safeUrl(url),
      hasServiceKey: true,
      reachable: true,
      status: response.status,
      body: (await response.text()).slice(0, 120),
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
  const pgResults = [];
  for (const name of PG_CANDIDATES) {
    const value = process.env[name];
    if (value) pgResults.push(await testPg(name, value));
  }
  return NextResponse.json(
    { pg: pgResults, rest: await testRest() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
