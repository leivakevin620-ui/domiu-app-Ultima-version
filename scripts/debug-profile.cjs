/**
 * Diagnóstico del perfil: verifica que el usuario exista en Auth
 * y que tenga un perfil en la tabla profiles.
 *
 * USO: node scripts/debug-profile.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// ── read .env.local ──────────────────────────────────────────
const envPath = path.resolve(__dirname, '..', '.env.local');
const content = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of content.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const ADMIN_EMAIL = 'domiumagdalena@gmail.com';

// ── helpers ──────────────────────────────────────────────────
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function maskId(id) {
  if (!id) return '(empty)';
  return id.slice(0, 8) + '...' + id.slice(-4);
}

// ── main ─────────────────────────────────────────────────────
(async () => {
  console.log('');
  console.log('============================================================');
  console.log('  DIAGNÓSTICO DE PERFIL');
  console.log('============================================================');
  console.log('');

  // ── 1. Auth user ───────────────────────────────────────────
  console.log('─── TAREA 1: Buscar usuario en Auth ───');
  const svc = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  // Use admin API to find user by email
  const { data: users, error: listError } = await svc.auth.admin.listUsers();
  if (listError) {
    console.log('  ERROR listUsers:', listError.message);
    console.log('  (puede que no tengas permisos de admin en el proyecto)');
    return;
  }
  const adminUser = users.users.find(u => u.email === ADMIN_EMAIL);
  if (!adminUser) {
    console.log('  ERROR: usuario no encontrado en Auth');
    return;
  }
  console.log('  Email:     ', adminUser.email);
  console.log('  ID:        ', maskId(adminUser.id));
  console.log('  ID real:   ', adminUser.id);
  console.log('  Confirmado:', adminUser.email_confirmed_at ? 'SÍ' : 'NO');
  console.log('');

  // ── 2. Tabla profiles ─────────────────────────────────────
  console.log('─── TAREA 2: Esquema de profiles ───');
  // Get column info via a raw query
  const { data: colQuery, error: colError } = await svc.rpc('exec_sql', {
    query: `SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'profiles'
            ORDER BY ordinal_position`
  });
  if (colError) {
    console.log('  (no se puede consultar esquema via RPC):', colError.message);
    // Fallback: just get a row to see columns
    const { data: sample } = await svc.from('profiles').select('*').limit(1);
    if (sample && sample.length > 0) {
      console.log('  Columnas (de muestra):', Object.keys(sample[0]).join(', '));
    } else {
      console.log('  Tabla vacía, columnas desconocidas');
    }
  } else {
    console.log('  Columnas:');
    for (const c of colQuery) {
      console.log(`    ${c.column_name} (${c.data_type}) nullable=${c.is_nullable}`);
    }
  }
  console.log('');

  // ── 3. Buscar perfil por id ───────────────────────────────
  console.log('─── TAREA 3: Buscar perfil por id ───');
  const { data: profileById, error: errById } = await svc
    .from('profiles')
    .select('*')
    .eq('id', adminUser.id)
    .maybeSingle();
  if (errById) {
    console.log('  ERROR:', errById.message);
  } else if (profileById) {
    console.log('  ENCONTRADO por id');
    console.log('  Contenido:', JSON.stringify(profileById, null, 2));
  } else {
    console.log('  NO ENCONTRADO por id');
  }
  console.log('');

  // ── 4. Buscar perfil por otros campos ─────────────────────
  console.log('─── TAREA 4: Buscar por user_id ───');
  const { data: profileByUserId, error: errByUserId } = await svc
    .from('profiles')
    .select('*')
    .eq('user_id', adminUser.id)
    .maybeSingle();
  if (errByUserId) {
    console.log('  ERROR:', errByUserId.message);
  } else if (profileByUserId) {
    console.log('  ENCONTRADO por user_id');
    console.log('  Contenido:', JSON.stringify(profileByUserId, null, 2));
  } else {
    console.log('  NO ENCONTRADO por user_id');
  }
  console.log('');

  console.log('─── TAREA 5: Buscar por email ───');
  const { data: profileByEmail, error: errByEmail } = await svc
    .from('profiles')
    .select('*')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();
  if (errByEmail) {
    console.log('  ERROR:', errByEmail.message);
  } else if (profileByEmail) {
    console.log('  ENCONTRADO por email');
    console.log('  Contenido:', JSON.stringify(profileByEmail, null, 2));
  } else {
    console.log('  NO ENCONTRADO por email');
  }
  console.log('');

  // ── 5. Mostrar todos los perfiles ─────────────────────────
  console.log('─── TAREA 6: Todos los perfiles ───');
  const { data: allProfiles, error: errAll } = await svc
    .from('profiles')
    .select('id, user_id, email, role, status, full_name, first_name, last_name')
    .limit(50);
  if (errAll) {
    console.log('  ERROR:', errAll.message);
  } else if (allProfiles && allProfiles.length > 0) {
    console.log(`  Total: ${allProfiles.length} perfiles`);
    for (const p of allProfiles) {
      console.log(`    id=${maskId(p.id)} user_id=${maskId(p.user_id)} email=${p.email} role=${p.role} status=${p.status}`);
    }
  } else {
    console.log('  (vacía)');
  }
  console.log('');

  // ── 6. Acción correctiva ──────────────────────────────────
  console.log('─── TAREA 7: Acción correctiva ───');
  if (!profileById) {
    console.log('  El perfil NO existe. Creándolo...');
    const profileData = {
      id: adminUser.id,
      email: ADMIN_EMAIL,
      full_name: 'Super Administrador DomiU',
      role: 'admin',
      status: 'active',
    };
    const { data: created, error: createError } = await svc
      .from('profiles')
      .insert(profileData)
      .select()
      .single();
    if (createError) {
      console.log('  ERROR al crear:', createError.message);
      // Try without full_name
      console.log('  Intentando sin full_name...');
      const { id, email, role, status } = profileData;
      const { data: c2, error: e2 } = await svc
        .from('profiles')
        .insert({ id, email, role, status })
        .select()
        .single();
      if (e2) {
        console.log('  ERROR (sin full_name):', e2.message);
      } else {
        console.log('  CREADO:', JSON.stringify(c2, null, 2));
      }
    } else {
      console.log('  CREADO:', JSON.stringify(created, null, 2));
    }
  } else {
    console.log('  El perfil YA EXISTE. Verificando role/status...');
    const needsUpdate = [];
    if (profileById.role !== 'admin') needsUpdate.push('role');
    if (profileById.status !== 'active') needsUpdate.push('status');
    if (profileById.email !== ADMIN_EMAIL) needsUpdate.push('email');
    if (needsUpdate.length > 0) {
      console.log(`  Actualizando: ${needsUpdate.join(', ')}`);
      const updateData = {};
      if (needsUpdate.includes('role')) updateData.role = 'admin';
      if (needsUpdate.includes('status')) updateData.status = 'active';
      if (needsUpdate.includes('email')) updateData.email = ADMIN_EMAIL;
      const { data: updated, error: upError } = await svc
        .from('profiles')
        .update(updateData)
        .eq('id', adminUser.id)
        .select()
        .single();
      if (upError) {
        console.log('  ERROR al actualizar:', upError.message);
      } else {
        console.log('  ACTUALIZADO:', JSON.stringify(updated, null, 2));
      }
    } else {
      console.log('  Todo correcto.');
    }
  }
  console.log('');

  // ── 7. Prueba directa: login + fetch /api/profile ─────────
  console.log('─── TAREA 8: Prueba login directo + fetch /api/profile ───');
  console.log('  (Requiere servidor en http://localhost:3000)');
  console.log('  Haciendo login con anon key...');
  const anonClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: loginData, error: loginError } = await anonClient.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: '11930421042026'
  });
  if (loginError) {
    console.log('  ERROR login:', loginError.message);
  } else {
    console.log('  Login OK');
    console.log('  User ID:', maskId(loginData.user.id));
    const token = loginData.session.access_token;
    console.log('  Token:', token.slice(0, 20) + '...');
    console.log('  Fetching /api/profile...');
    try {
      const ac = new AbortController();
      setTimeout(() => ac.abort(), 8000);
      const res = await fetch('http://localhost:3000/api/profile', {
        headers: { Authorization: 'Bearer ' + token },
        signal: ac.signal
      });
      console.log('  Status:', res.status);
      if (res.ok) {
        const body = await res.json();
        console.log('  Profile:', JSON.stringify(body.profile, null, 2));
        console.log('  TEST: OK');
      } else {
        const body = await res.text();
        console.log('  Error body:', body);
      }
    } catch (e) {
      console.log('  Network error:', e.message);
    }
  }

  console.log('');
  console.log('============================================================');
  console.log('  DIAGNÓSTICO COMPLETADO');
  console.log('============================================================');
})();
