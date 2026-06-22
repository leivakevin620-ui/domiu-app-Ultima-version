/**
 * Crea el Super Admin inicial (domiumagdalena@gmail.com) en Supabase Auth + profiles.
 *
 * USO:
 *   npm run create:super-admin
 *
 * PRECAUCION:
 *   - Lee SUPABASE_SERVICE_ROLE_KEY desde .env.local
 *   - Nunca imprime claves, tokens ni passwords completas
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const SUPER_ADMIN_EMAIL = 'domiumagdalena@gmail.com';
const SUPER_ADMIN_PASSWORD = '11930421042026';
const SUPER_ADMIN_NAME = 'Super Administrador DomiU';

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
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

function mask(val) {
  if (!val || typeof val !== 'string') return '';
  if (val.length <= 8) return '***';
  return val.slice(0, 4) + '...' + val.slice(-4);
}

async function main() {
  console.log('=== Crear Super Admin ===================');
  console.log('');

  const localEnv = readEnv('.env.local');
  const url = localEnv.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = localEnv.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL no encontrada en .env.local');
    process.exit(1);
  }
  if (!serviceKey) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY no encontrada en .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Buscar usuario existente
  console.log(`[${SUPER_ADMIN_EMAIL}] Buscando usuario...`);
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error(`ERROR al listar usuarios: ${listError.message}`);
    process.exit(1);
  }

  const existing = usersData.users.find((u) => u.email === SUPER_ADMIN_EMAIL);
  let userId;

  if (existing) {
    userId = existing.id;
    console.log(`  → Usuario ya existe. ID: ${mask(userId)}`);

    // Actualizar contraseña
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: SUPER_ADMIN_PASSWORD,
    });
    if (updateError) {
      console.error(`  → Error actualizando contraseña: ${updateError.message}`);
    } else {
      console.log('  → Contraseña actualizada.');
    }
  } else {
    console.log('  → Usuario no encontrado. Creando...');
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { firstName: 'Super', lastName: 'Administrador DomiU' },
    });

    if (createError) {
      console.error(`ERROR creando usuario: ${createError.message}`);
      process.exit(1);
    }

    userId = newUser.user.id;
    console.log(`  → Usuario creado. ID: ${mask(userId)}`);
  }

  // 2. Crear o actualizar perfil
  console.log('');
  console.log(`[${SUPER_ADMIN_EMAIL}] Buscando perfil...`);

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  const profileData = {
    id: userId,
    email: SUPER_ADMIN_EMAIL,
    role: 'admin',
    first_name: 'Super',
    last_name: 'Administrador DomiU',
    status: 'active',
  };

  if (existingProfile) {
    console.log('  → Perfil ya existe. Actualizando...');
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', userId);

    if (updateProfileError) {
      console.error(`  → Error actualizando perfil: ${updateProfileError.message}`);
      process.exit(1);
    }
    console.log('  → Perfil actualizado correctamente.');
  } else {
    console.log('  → Perfil no encontrado. Creando...');
    const { error: createProfileError } = await supabase
      .from('profiles')
      .insert(profileData);

    if (createProfileError) {
      console.error(`  → Error creando perfil: ${createProfileError.message}`);
      process.exit(1);
    }
    console.log('  → Perfil creado correctamente.');
  }

  // 3. Verificar
  console.log('');
  console.log('Verificando perfil...');
  const { data: verified, error: verifyError } = await supabase
    .from('profiles')
    .select('id, email, role, status')
    .eq('id', userId)
    .single();

  if (verifyError || !verified) {
    console.error(`ERROR en verificación: ${verifyError?.message || 'Perfil no encontrado'}`);
    process.exit(1);
  }

  if (verified.role === 'admin' && verified.status === 'active') {
    console.log('  → Perfil verificado correctamente.');
  } else {
    console.error('  → Perfil con datos incorrectos:', JSON.stringify(verified));
    process.exit(1);
  }

  console.log('');
  console.log('=== Resumen =============================');
  console.log(`  Email:   ${SUPER_ADMIN_EMAIL}`);
  if (existing) {
    console.log('  Usuario: ya existía (contraseña actualizada)');
  } else {
    console.log('  Usuario: creado');
  }
  if (existingProfile) {
    console.log('  Perfil:  actualizado');
  } else {
    console.log('  Perfil:  creado');
  }
  console.log('  Rol:     admin');
  console.log('  Estado:  active');
  console.log('========================================');
}

main().catch((err) => {
  console.error('Error inesperado:', err.message);
  process.exit(1);
});
