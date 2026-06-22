/**
 * Depura qué variables NEXT_PUBLIC_* estarán disponibles en el navegador.
 *
 * Next.js inlinea las variables NEXT_PUBLIC_* en tiempo de compilación.
 * Este script lee .env.local y muestra las que llegarán al browser.
 *
 * USO: node scripts/debug-browser-env.cjs
 */

const path = require('path');
const fs = require('fs');

function readEnv(fileName) {
  const envPath = path.resolve(__dirname, '..', fileName);
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[trimmed.slice(0, idx).trim()] = value;
  }
  return env;
}

function projectRef(url) {
  try { return new URL(url).hostname.split('.')[0]; } catch { return null; }
}

function mask(val) {
  if (!val || typeof val !== 'string') return '(empty)';
  if (val.startsWith('http')) { const u = new URL(val); return `${u.protocol}//${u.hostname}`; }
  if (val.length > 16) return val.slice(0, 8) + '...';
  return '(set)';
}

console.log('========================================');
console.log('  Debug: NEXT_PUBLIC_* env for browser');
console.log('========================================');
console.log('');

const localEnv = readEnv('.env.local');

const publicVars = Object.keys(localEnv).filter(k => k.startsWith('NEXT_PUBLIC_') || k === 'NODE_ENV');
for (const key of publicVars.sort()) {
  const val = localEnv[key];
  console.log(`  ${key}:`);
  console.log(`    value:     ${mask(val)}`);
  if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
    const ref = projectRef(val);
    console.log(`    ref:       ${ref}`);
    console.log(`    expected:  vuwaqmwgvldqmmgkpyjh`);
    console.log(`    match:     ${ref === 'vuwaqmwgvldqmmgkpyjh' ? 'YES' : 'NO — MISMATCH!'}`);
  }
  if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' && val) {
    try {
      const payload = JSON.parse(Buffer.from(val.split('.')[1] || '', 'base64').toString());
      console.log(`    ref in JWT: ${payload.ref || 'N/A'}`);
      console.log(`    match:      ${payload.ref === 'vuwaqmwgvldqmmgkpyjh' ? 'YES' : 'NO — MISMATCH!'}`);
    } catch { console.log('    (cannot decode JWT)'); }
  }
  console.log('');
}

console.log('========================================');
console.log('');
console.log('NOTE: Next.js replaces process.env.NEXT_PUBLIC_* at BUILD time.');
console.log('If you changed .env.local, you MUST restart `npm run dev`.');
console.log('A hard refresh (Ctrl+F5) in the browser is NOT enough.');
console.log('');
