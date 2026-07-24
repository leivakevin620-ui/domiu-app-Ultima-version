import pg from 'pg';
import crypto from 'node:crypto';

const { Client } = pg;

const sourceUrl = process.env.SOURCE_DB_URL;
const targetUrl = process.env.TARGET_DB_URL;

if (!sourceUrl || !targetUrl) {
  throw new Error('Faltan SOURCE_DB_URL o TARGET_DB_URL');
}

const source = new Client({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false } });
const target = new Client({ connectionString: targetUrl, ssl: { rejectUnauthorized: false } });

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function hashRow(schema, table, row) {
  return crypto
    .createHash('sha256')
    .update(`${schema}.${table}\n${JSON.stringify(row)}`)
    .digest('hex');
}

async function ensureRecoverySchema() {
  await target.query(`create schema if not exists legacy_recovery`);
  await target.query(`
    create table if not exists legacy_recovery.source_rows (
      source_schema text not null,
      source_table text not null,
      row_hash text not null,
      row_data jsonb not null,
      recovered_at timestamptz not null default now(),
      primary key (source_schema, source_table, row_hash)
    )
  `);
  await target.query(`
    create table if not exists legacy_recovery.manifest (
      source_schema text not null,
      source_table text not null,
      source_count bigint not null,
      recovered_count bigint not null,
      recovered_at timestamptz not null default now(),
      primary key (source_schema, source_table)
    )
  `);
  await target.query(`revoke all on schema legacy_recovery from anon, authenticated`);
  await target.query(`revoke all on all tables in schema legacy_recovery from anon, authenticated`);
}

async function listSourceTables() {
  const { rows } = await source.query(`
    select table_schema, table_name
    from information_schema.tables
    where table_type = 'BASE TABLE'
      and (
        table_schema = 'public'
        or (table_schema = 'auth' and table_name in ('users', 'identities'))
        or (table_schema = 'storage' and table_name in ('buckets', 'objects'))
      )
    order by table_schema, table_name
  `);
  return rows;
}

async function recoverTable(schema, table) {
  const qualified = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const countResult = await source.query(`select count(*)::bigint as count from ${qualified}`);
  const sourceCount = Number(countResult.rows[0]?.count || 0);
  const batchSize = 500;
  let offset = 0;
  let recovered = 0;

  while (offset < sourceCount) {
    const result = await source.query(
      `select to_jsonb(src) as row_data from ${qualified} as src offset $1 limit $2`,
      [offset, batchSize],
    );

    if (!result.rows.length) break;

    await target.query('begin');
    try {
      for (const item of result.rows) {
        const row = item.row_data;
        const rowHash = hashRow(schema, table, row);
        const insert = await target.query(
          `insert into legacy_recovery.source_rows
             (source_schema, source_table, row_hash, row_data)
           values ($1, $2, $3, $4::jsonb)
           on conflict do nothing`,
          [schema, table, rowHash, JSON.stringify(row)],
        );
        recovered += insert.rowCount || 0;
      }
      await target.query('commit');
    } catch (error) {
      await target.query('rollback');
      throw error;
    }

    offset += result.rows.length;
  }

  const targetCountResult = await target.query(
    `select count(*)::bigint as count
       from legacy_recovery.source_rows
      where source_schema = $1 and source_table = $2`,
    [schema, table],
  );
  const recoveredCount = Number(targetCountResult.rows[0]?.count || 0);

  await target.query(
    `insert into legacy_recovery.manifest
       (source_schema, source_table, source_count, recovered_count, recovered_at)
     values ($1, $2, $3, $4, now())
     on conflict (source_schema, source_table)
     do update set source_count = excluded.source_count,
                   recovered_count = excluded.recovered_count,
                   recovered_at = now()`,
    [schema, table, sourceCount, recoveredCount],
  );

  console.log(`${schema}.${table}: origen=${sourceCount}, resguardados=${recoveredCount}, nuevos=${recovered}`);
}

try {
  await source.connect();
  await target.connect();
  await target.query(`select pg_advisory_lock(2026072401)`);
  await ensureRecoverySchema();

  const tables = await listSourceTables();
  console.log(`Tablas detectadas para recuperación: ${tables.length}`);

  for (const { table_schema: schema, table_name: table } of tables) {
    await recoverTable(schema, table);
  }

  await target.query(`select pg_advisory_unlock(2026072401)`);
  console.log('RECOVERY_COMPLETE');
} finally {
  await source.end().catch(() => undefined);
  await target.end().catch(() => undefined);
}
