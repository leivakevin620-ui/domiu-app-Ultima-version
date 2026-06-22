const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BLUE = '\x1b[34m';

const EXPECTED_BUCKETS = {
  'business-logos': { public: true },
  'business-banners': { public: true },
  'product-images': { public: true },
  promotions: { public: true },
  categories: { public: true },
  'user-avatars': { public: true },
  'chat-files': { public: false },
  'ratings-images': { public: true },
};

const EXPECTED_REALTIME_TABLES = ['notifications', 'messages', 'orders', 'driver_locations'];
const EXPECTED_STORAGE_POLICIES = [
  'Public read public storage buckets',
  'Authenticated read private chat files',
  'Owners upload business media',
  'Owners upload product images',
  'Admins upload promotions and categories',
  'Users upload own avatars',
  'Authenticated upload chat files',
  'Authenticated upload rating images',
  'Owners update own storage objects',
  'Owners delete own storage objects',
];

const results = [];

function icon(status) {
  if (status === 'PASS') return `${GREEN}OK${RESET}`;
  if (status === 'CRITICAL') return `${RED}CRITICAL${RESET}`;
  if (status === 'WARNING') return `${YELLOW}WARNING${RESET}`;
  return `${BLUE}INFO${RESET}`;
}

function record(status, label, detail = '') {
  results.push({ status, label, detail });
  console.log(`  ${icon(status)} ${label}${detail ? ` - ${detail}` : ''}`);
}

function pass(label, detail) { record('PASS', label, detail); }
function critical(label, detail) { record('CRITICAL', label, detail); }
function warning(label, detail) { record('WARNING', label, detail); }
function info(label, detail) { record('INFO', label, detail); }

function header(text) {
  console.log(`\n${CYAN}${BOLD}=== ${text} ===${RESET}\n`);
}

function readEnvFile(fileName) {
  const envPath = path.resolve(__dirname, '..', fileName);
  if (!fs.existsSync(envPath)) return {};

  const env = {};
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function getEnv() {
  return {
    ...readEnvFile('.env.production'),
    ...readEnvFile('.env.local'),
    ...process.env,
  };
}

function mask(value) {
  if (!value) return '';
  if (value.startsWith('http')) return value;
  return `${value.slice(0, 16)}...`;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function getProjectRef(supabaseUrl) {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0];
  } catch {
    return null;
  }
}

function getDatabaseUrl(env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.SUPABASE_DB_URL) return env.SUPABASE_DB_URL;

  const projectRef = getProjectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  if (projectRef && env.SUPABASE_DB_PASSWORD) {
    return `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.${projectRef}.supabase.co:5432/postgres`;
  }

  return null;
}

function commandExists(command) {
  try {
    const probe = process.platform === 'win32' ? 'where.exe' : 'which';
    execFileSync(probe, [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkVercelEnv() {
  if (!commandExists('vercel')) {
    warning('Vercel env', 'not verifiable: vercel CLI not available');
    return;
  }

  let output = '';
  try {
    output = execFileSync('vercel', ['env', 'ls'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
    });
  } catch (error) {
    warning('Vercel env', `not verifiable: ${error.message}`);
    return;
  }

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
  ];

  for (const key of required) {
    if (output.includes(key)) pass(`Vercel env ${key}`, 'listed by vercel env ls');
    else warning(`Vercel env ${key}`, 'not listed by vercel env ls');
  }
}

async function listBucketObjects(supabase, bucket) {
  const { data, error } = await supabase.storage.from(bucket).list('', { limit: 100, offset: 0 });
  if (error) return { error: error.message, count: null };
  return { error: null, count: data?.length ?? 0 };
}

async function checkSqlState(env) {
  const databaseUrl = getDatabaseUrl(env);
  if (!databaseUrl) {
    warning('Storage policies', 'not verifiable: set DATABASE_URL, SUPABASE_DB_URL, or SUPABASE_DB_PASSWORD');
    warning('Realtime publication', 'not verifiable: set DATABASE_URL, SUPABASE_DB_URL, or SUPABASE_DB_PASSWORD');
    return;
  }

  let Client;
  try {
    ({ Client } = require('pg'));
  } catch (error) {
    warning('SQL checks', `pg dependency unavailable: ${error.message}`);
    return;
  }

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();

    const policies = await client.query(
      "select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'",
    );
    const policyNames = new Set(policies.rows.map((row) => row.policyname));
    const missingPolicies = EXPECTED_STORAGE_POLICIES.filter((name) => !policyNames.has(name));
    if (missingPolicies.length === 0) {
      pass('Storage policies', `${EXPECTED_STORAGE_POLICIES.length} expected policies present`);
    } else {
      critical('Storage policies missing', missingPolicies.join(', '));
    }

    const realtime = await client.query(
      "select tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'",
    );
    const realtimeTables = new Set(realtime.rows.map((row) => row.tablename));
    const missingRealtime = EXPECTED_REALTIME_TABLES.filter((table) => !realtimeTables.has(table));
    if (missingRealtime.length === 0) {
      pass('Realtime publication', `${EXPECTED_REALTIME_TABLES.join(', ')} present`);
    } else {
      critical('Realtime tables missing', missingRealtime.join(', '));
    }
  } catch (error) {
    warning('SQL checks', `not verifiable: ${error.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  console.log(`${BOLD}${CYAN}DomiU App - Environment Checker${RESET}`);
  const env = getEnv();

  header('Environment Variables');
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_APP_URL',
  ];

  for (const key of required) {
    if (env[key]) pass(key, mask(env[key]));
    else critical(key, 'missing');
  }

  if (env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) pass('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'defined');
  else warning('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'missing locally; maps pages will render fallbacks');

  header('Supabase API');
  if (env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const res = await httpGet(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`);
      if ([200, 400, 401].includes(res.status)) pass('REST endpoint reachable', `status ${res.status}`);
      else warning('REST endpoint reachable', `unexpected status ${res.status}`);
    } catch (error) {
      critical('REST endpoint unreachable', error.message);
    }
  }

  header('Storage Buckets');
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      critical('Bucket listing failed', error.message);
    } else {
      const buckets = new Map((data || []).map((bucket) => [bucket.id, bucket]));
      const missing = Object.keys(EXPECTED_BUCKETS).filter((id) => !buckets.has(id));
      if (missing.length === 0) pass('Expected buckets', `${Object.keys(EXPECTED_BUCKETS).length} present`);
      else critical('Missing buckets', missing.join(', '));

      for (const [id, expected] of Object.entries(EXPECTED_BUCKETS)) {
        const bucket = buckets.get(id);
        if (!bucket) continue;
        const visibility = bucket.public === expected.public ? 'visibility OK' : `expected public=${expected.public}, got ${bucket.public}`;
        if (bucket.public === expected.public) pass(`Bucket ${id}`, visibility);
        else critical(`Bucket ${id}`, visibility);
      }

      if (buckets.has('avatars')) {
        const legacy = await listBucketObjects(supabase, 'avatars');
        if (legacy.error) warning('Legacy bucket avatars', `exists; could not list objects: ${legacy.error}`);
        else if (legacy.count === 0) info('Legacy bucket avatars', 'exists and appears empty; safe deletion can be scheduled manually');
        else warning('Legacy bucket avatars', `exists with ${legacy.count} root object(s); migrate before deleting`);
      } else {
        pass('Legacy bucket avatars', 'not present');
      }
    }
  } else {
    critical('Storage buckets', 'Supabase URL or service role missing');
  }

  header('Authentication');
  if (env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const res = await httpGet(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`);
      if ([200, 401, 403].includes(res.status)) pass('Auth endpoint reachable', `status ${res.status}`);
      else warning('Auth endpoint reachable', `unexpected status ${res.status}`);
    } catch (error) {
      warning('Auth endpoint', error.message);
    }
  }

  header('Realtime Endpoint');
  if (env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const res = await httpGet(`${env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/`);
      if ([200, 401, 404].includes(res.status)) pass('Realtime endpoint reachable', `status ${res.status}`);
      else warning('Realtime endpoint reachable', `unexpected status ${res.status}`);
    } catch (error) {
      warning('Realtime endpoint', error.message);
    }
  }

  header('SQL Verification');
  await checkSqlState(env);

  header('Vercel Environment');
  checkVercelEnv();

  header('Local Supabase Files');
  const supabaseDir = path.resolve(__dirname, '..', 'supabase');
  if (fs.existsSync(path.join(supabaseDir, 'config.toml'))) pass('supabase/config.toml', 'present');
  else critical('supabase/config.toml', 'missing');

  const migrationsDir = path.join(supabaseDir, 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const migrations = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql'));
    pass('Supabase migrations', `${migrations.length} SQL files`);
  } else {
    critical('Supabase migrations', 'missing directory');
  }

  header('Summary');
  const counts = {
    pass: results.filter((item) => item.status === 'PASS').length,
    critical: results.filter((item) => item.status === 'CRITICAL').length,
    warning: results.filter((item) => item.status === 'WARNING').length,
    info: results.filter((item) => item.status === 'INFO').length,
  };

  console.log(`  ${GREEN}PASS${RESET}: ${counts.pass}`);
  console.log(`  ${RED}CRITICAL${RESET}: ${counts.critical}`);
  console.log(`  ${YELLOW}WARNING${RESET}: ${counts.warning}`);
  console.log(`  ${BLUE}INFO${RESET}: ${counts.info}`);

  if (counts.critical > 0) {
    console.log(`\n  ${RED}${BOLD}Critical issues must be fixed before production.${RESET}`);
  } else if (counts.warning > 0) {
    console.log(`\n  ${YELLOW}${BOLD}No critical issues found. Review warnings before production.${RESET}`);
  } else {
    console.log(`\n  ${GREEN}${BOLD}Environment checks passed without warnings.${RESET}`);
  }

  process.exit(counts.critical > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`${RED}CRITICAL${RESET} Script error:`, error);
  process.exit(1);
});
