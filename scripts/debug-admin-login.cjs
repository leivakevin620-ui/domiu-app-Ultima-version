/**
 * Diagnóstico completo de login para domiumagdalena@gmail.com
 *
 * Fases:
 *   1. Identificar proyecto Supabase
 *   2. Probar login directo con anon key
 *   3. Verificar/crear usuario con service role
 *   4. Verificar/crear profile
 *   5. Reprobar login
 *   6. Verificar ruta de redirección
 *
 * USO: node scripts/debug-admin-login.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const EMAIL = 'domiumagdalena@gmail.com';
const PASSWORD = '11930421042026';

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

function maskUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return url.slice(0, 30) + '...';
  }
}

function maskKey(key) {
  if (!key || typeof key !== 'string') return '';
  if (key.length <= 8) return '***';
  return key.slice(0, 6) + '...' + key.slice(-4);
}

function header(text) {
  console.log('');
  console.log('='.repeat(60));
  console.log(`  ${text}`);
  console.log('='.repeat(60));
}

function ok(label, detail = '') {
  console.log(`  [OK] ${label}${detail ? ' — ' + detail : ''}`);
}

function fail(label, detail = '') {
  console.log(`  [FAIL] ${label}${detail ? ' — ' + detail : ''}`);
}

function info(label, detail = '') {
  console.log(`  [INFO] ${label}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  const localEnv = readEnv('.env.local');
  const prodEnv = readEnv('.env.production');

  const url = localEnv.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = localEnv.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ========== FASE 1 — Identificar proyecto ==========
  header('FASE 1 — Proyecto Supabase');

  const expectedRef = 'vuwaqmwgvldqmmgkpyjh';
  let actualRef = '';
  try {
    actualRef = new URL(url).hostname.split('.')[0];
  } catch {
    // ignore
  }

  info('URL (sin clave):', maskUrl(url));
  info('Project ref:', actualRef);
  info('Esperado:', expectedRef);

  if (actualRef === expectedRef) {
    ok('Project ref coincide con DomiU App 1.0');
  } else {
    fail('Project ref NO coincide', `app usa ${actualRef}, esperado ${expectedRef}`);
  }

  // Verificar anon key vs URL
  if (anonKey) {
    try {
      const parts = Buffer.from(anonKey.split('.')[1] || '', 'base64').toString();
      const payload = JSON.parse(parts);
      if (payload.ref === actualRef) {
        ok('ANON_KEY pertenece al mismo proyecto');
      } else {
        fail('ANON_KEY pertenece a otro proyecto', `ref=${payload.ref || 'desconocido'}`);
      }
    } catch {
      info('No se pudo decodificar ANON_KEY');
    }
  }

  // ========== FASE 2 — Login directo ==========
  header('FASE 2 — Login directo con anon key');

  const anonClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let loginResult = null;
  try {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });
    loginResult = { data, error };
  } catch (err) {
    loginResult = { data: null, error: err };
  }

  if (loginResult.error) {
    fail('Login FALLÓ', `código: ${loginResult.error.name || 'unknown'}, mensaje: "${loginResult.error.message}"`);

    if (loginResult.error.message === 'Invalid login credentials') {
      info('Causa más probable: usuario no existe o contraseña incorrecta en este proyecto');
    } else if (loginResult.error.message === 'Email not confirmed') {
      info('Causa: email no confirmado');
    } else if (loginResult.error.message && loginResult.error.message.includes('network')) {
      info('Causa: error de red — verifica que la URL sea correcta');
    }
  } else {
    ok('Login EXITOSO');
    info('User ID:', loginResult.data.user.id);
    info('Email:', loginResult.data.user.email);
    info('Email confirmed:', loginResult.data.user.email_confirmed_at ? 'sí' : 'no');
    info('Provider:', loginResult.data.user.app_metadata?.provider || 'email');
  }

  // ========== FASE 3 — Verificar con service role ==========
  header('FASE 3 — Verificación con service role');

  if (!serviceKey) {
    fail('SUPABASE_SERVICE_ROLE_KEY no disponible');
    process.exit(1);
  }

  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userRecord = null;
  let found = false;

  const { data: usersData, error: listErr } = await adminClient.auth.admin.listUsers();
  if (listErr) {
    fail('Error listando usuarios:', listErr.message);
    process.exit(1);
  }

  userRecord = usersData.users.find((u) => u.email === EMAIL);
  found = !!userRecord;

  if (found) {
    ok('Usuario existe en Auth');
    info('ID:', userRecord.id);
    info('Email confirmado:', userRecord.email_confirmed_at ? `sí (${userRecord.email_confirmed_at})` : 'no');
    info('Provider:', userRecord.app_metadata?.provider || 'email');
    info('Suspended:', userRecord.banned_until ? `sí (hasta ${userRecord.banned_until})` : 'no');
    info('Created at:', userRecord.created_at);
    info('Last sign in:', userRecord.last_sign_in_at || 'nunca');

    // Actualizar contraseña SIEMPRE para asegurar
    info('Actualizando contraseña...');
    const { error: pwErr } = await adminClient.auth.admin.updateUserById(userRecord.id, {
      password: PASSWORD,
    });
    if (pwErr) {
      fail('Error actualizando contraseña:', pwErr.message);
    } else {
      ok('Contraseña actualizada');

      // Confirmar email si hace falta
      if (!userRecord.email_confirmed_at) {
        info('Email no estaba confirmado. Confirmando...');
        const { error: confirmErr } = await adminClient.auth.admin.updateUserById(userRecord.id, {
          email_confirm: true,
        });
        if (confirmErr) {
          fail('Error confirmando email:', confirmErr.message);
        } else {
          ok('Email confirmado');
        }
      }
    }
  } else {
    fail('Usuario NO existe en este proyecto');
    info('Creando usuario...');

    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { firstName: 'Super', lastName: 'Administrador DomiU' },
    });

    if (createErr) {
      fail('Error creando usuario:', createErr.message);
      process.exit(1);
    }

    ok('Usuario creado');
    userRecord = newUser.user;
    info('ID:', userRecord.id);
  }

  // ========== FASE 4 — Verificar profile ==========
  header('FASE 4 — Tabla profiles');

  const { data: existingProfile, error: profileQueryErr } = await adminClient
    .from('profiles')
    .select('id, email, role, status')
    .eq('id', userRecord.id)
    .maybeSingle();

  if (profileQueryErr) {
    fail('Error consultando profile:', profileQueryErr.message);
  } else if (existingProfile) {
    ok('Profile existe');
    info('Role:', existingProfile.role);
    info('Status:', existingProfile.status);

    // Actualizar si hace falta
    if (existingProfile.role !== 'admin' || existingProfile.status !== 'active') {
      info('Actualizando profile...');
      const { error: updErr } = await adminClient
        .from('profiles')
        .update({ role: 'admin', status: 'active' })
        .eq('id', userRecord.id);

      if (updErr) {
        fail('Error actualizando profile:', updErr.message);
      } else {
        ok('Profile actualizado a role=admin, status=active');
      }
    } else {
      ok('Profile ya estaba correcto (admin, active)');
    }
  } else {
    info('Profile no existe. Creando...');
    const { error: createProfileErr } = await adminClient
      .from('profiles')
      .insert({
        id: userRecord.id,
        email: EMAIL,
        role: 'admin',
        first_name: 'Super',
        last_name: 'Administrador DomiU',
        status: 'active',
      });

    if (createProfileErr) {
      fail('Error creando profile:', createProfileErr.message);
    } else {
      ok('Profile creado (role=admin, status=active)');
    }
  }

  // ========== FASE 5 — Reprobar login ==========
  header('FASE 5 — Reprobar login con anon key');

  try {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });

    if (error) {
      fail('Login AÚN FALLA después de corrección', `"${error.message}"`);
      info('Posibles causas restantes:');
      info('  1. La app usa otra NEXT_PUBLIC_SUPABASE_URL en .env.local');
      info('  2. La app usa variables de Vercel en producción');
      info('  3. El proyecto de Supabase cambió');
      info('  4. Hay un middleware que bloquea peticiones');
    } else {
      ok('Login EXITOSO después de corrección');
      info('User ID:', data.user.id);
      ok('La app debería funcionar ahora');
    }
  } catch (err) {
    fail('Login lanzó excepción:', err.message);
  }

  // ========== FASE 6 — Verificar redirección ==========
  header('FASE 6 — Ruta de redirección');

  const adminRoles = ['super_admin', 'admin_general', 'admin_financiero', 'admin_operativo', 'admin_comercial', 'admin_soporte', 'admin'];
  const isAdmin = adminRoles.includes('admin');
  const expectedPath = isAdmin ? '/admin' : '/cliente';

  info('Helper: getDashboardPathForRole("admin")');
  if (isAdmin) {
    ok('Redirige a:', '/admin');
  } else {
    fail('Redirige a:', '/cliente (debería ser /admin)');
  }

  // ========== Resumen ==========
  header('RESUMEN FINAL');

  console.log(`  Supabase URL:     ${maskUrl(url)}`);
  console.log(`  Project ref:      ${actualRef}`);
  console.log(`  Coincide esperado: ${actualRef === expectedRef ? 'SÍ' : 'NO'}`);
  console.log(`  Usuario Auth:     ${found ? 'existía' : 'creado ahora'}`);
  console.log(`  Contraseña:       actualizada`);
  console.log(`  Email confirmado: ${userRecord?.email_confirmed_at ? 'sí' : 'no'}`);
  console.log(`  Profile existe:   ${existingProfile ? 'sí' : 'creado ahora'}`);
  console.log(`  Login final:      ${loginResult?.error ? 'FALLÓ' : 'OK'}`);
  console.log(`  Redirección:      ${expectedPath}`);
  console.log('');
}

main().catch((err) => {
  console.error('Error inesperado:', err.message);
  process.exit(1);
});
