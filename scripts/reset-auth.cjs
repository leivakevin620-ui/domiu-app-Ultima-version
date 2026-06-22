/**
 * Reset Auth — Fija TODAS las credenciales críticas en el proyecto Supabase.
 *
 * Garantiza que estos usuarios SIEMPRE existan con contraseña correcta:
 *   - Admin:  domiumagdalena@gmail.com / 11930421042026
 *   - Courier: alexriverapabon1@gmail.com / AlexRivera2026
 *
 * USO: node scripts/reset-auth.cjs
 */

const { createClient } = require('@supabase/supabase-js');
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

const localEnv = readEnv('.env.local');
const prodEnv = readEnv('.env.production');
const url = localEnv.NEXT_PUBLIC_SUPABASE_URL || prodEnv.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || prodEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = localEnv.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error('FALTAN variables de entorno. Revisa .env.local o .env.production');
  process.exit(1);
}

const USERS = [
  { email: 'domiumagdalena@gmail.com', password: '11930421042026', role: 'admin', firstName: 'Super', lastName: 'Admin' },
  { email: 'alexriverapabon1@gmail.com', password: 'AlexRivera2026', role: 'courier', firstName: 'Alex', lastName: 'Rivera' },
];

async function main() {
  console.log('🔧 Reset Auth — Diagnosticando y reparando usuarios...\n');

  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: usersData, error: listErr } = await adminClient.auth.admin.listUsers();
  if (listErr) {
    console.error('❌ Error listando usuarios:', listErr.message);
    process.exit(1);
  }

  for (const userDef of USERS) {
    console.log(`\n━━━ ${userDef.email} ━━━`);
    const existing = usersData.users.find((u) => u.email === userDef.email);

    if (existing) {
      console.log(`  ✓ Usuario existe en Auth (ID: ${existing.id})`);

      const { error: pwErr } = await adminClient.auth.admin.updateUserById(existing.id, {
        password: userDef.password,
        email_confirm: true,
      });
      console.log(pwErr ? `  ✗ Error actualizando contraseña: ${pwErr.message}` : '  ✓ Contraseña actualizada y email confirmado');

      const { data: profile } = await adminClient
        .from('profiles')
        .select('id, role, status')
        .eq('id', existing.id)
        .maybeSingle();

      if (profile) {
        console.log(`  ✓ Profile existe (role=${profile.role}, status=${profile.status})`);
        if (profile.role !== userDef.role || profile.status !== 'active') {
          await adminClient.from('profiles').update({ role: userDef.role, status: 'active' }).eq('id', existing.id);
          console.log(`  ✓ Profile actualizado a role=${userDef.role}, status=active`);
        }
      } else {
        await adminClient.from('profiles').insert({
          id: existing.id,
          email: userDef.email,
          role: userDef.role,
          first_name: userDef.firstName,
          last_name: userDef.lastName,
          status: 'active',
        });
        console.log('  ✓ Profile creado');
      }
    } else {
      console.log('  ✗ Usuario NO existe. Creando...');
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: userDef.email,
        password: userDef.password,
        email_confirm: true,
        user_metadata: { firstName: userDef.firstName, lastName: userDef.lastName },
      });

      if (createErr) {
        console.error(`  ✗ Error creando usuario: ${createErr.message}`);
        continue;
      }
      console.log(`  ✓ Usuario creado (ID: ${newUser.user.id})`);

      await adminClient.from('profiles').insert({
        id: newUser.user.id,
        email: userDef.email,
        role: userDef.role,
        first_name: userDef.firstName,
        last_name: userDef.lastName,
        status: 'active',
      });
      console.log('  ✓ Profile creado con role=' + userDef.role);
    }
  }

  console.log('\n━━━ VERIFICACIÓN FINAL ━━━');
  const anonClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const userDef of USERS) {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: userDef.email,
      password: userDef.password,
    });
    if (error) {
      console.log(`  ✗ ${userDef.email}: LOGIN FALLÓ — ${error.message}`);
    } else {
      console.log(`  ✓ ${userDef.email}: LOGIN OK (ID: ${data.user.id})`);
    }
  }

  console.log('\n✅ Reset Auth completado.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
