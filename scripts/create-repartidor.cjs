const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const email = 'alexriverapabon1@gmail.com';
  const password = '123456';
  const phone = '3044766270';

  // 1. Create or update auth user
  const { data: users } = await supabase.auth.admin.listUsers();
  let userId = users?.users?.find(u => u.email === email)?.id;

  if (userId) {
    console.log('Usuario auth ya existe, ID:', userId);
    await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
      phone_confirm: true,
      password: password,
    });
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: { full_name: 'Alexander Rivera Pabon' }
    });
    if (error) { console.log('Error auth:', error.message); return; }
    userId = data.user.id;
    console.log('Usuario auth creado, ID:', userId);
  }

  // 2. Insert profile WITHOUT role (defaults to 'customer') to avoid trigger conflict
  const { data: existingProfile } = await supabase
    .from('profiles').select('id').eq('id', userId).maybeSingle();

  if (!existingProfile) {
    const { error: pErr } = await supabase.from('profiles').insert({
      id: userId,
      email,
      first_name: 'Alexander',
      last_name: 'Rivera Pabon',
      phone,
      status: 'active'
    });
    if (pErr) { console.log('Error insert profile:', pErr.message); return; }
    console.log('Profile creado (role: customer por defecto)');
  }

  // 3. Update role to 'courier' (separate step, avoids trigger issue)
  const { error: rErr } = await supabase
    .from('profiles').update({ role: 'courier' }).eq('id', userId);

  if (rErr) { console.log('Error update role:', rErr.message); return; }
  console.log('Role actualizado a courier');

  // 4. Create or update driver record
  const { data: existingDriver } = await supabase
    .from('drivers').select('id').eq('id', userId).maybeSingle();

  if (existingDriver) {
    await supabase.from('drivers').update({
      license_number: '1193042104',
      vehicle_type: 'motorcycle',
      vehicle_plate: 'ABC123',
      is_active: true,
      is_verified: true,
      status: 'offline',
    }).eq('id', userId);
    console.log('Driver actualizado');
  } else {
    const { error: dErr } = await supabase.from('drivers').insert({
      id: userId,
      license_number: '1193042104',
      vehicle_type: 'motorcycle',
      vehicle_plate: 'ABC123',
      status: 'offline',
      is_active: true,
      is_verified: true,
      total_deliveries: 0,
      completed_deliveries: 0,
      rating: 0,
      total_ratings: 0,
      avg_rating: 0,
    });
    if (dErr) { console.log('Error driver:', dErr.message); return; }
    console.log('Driver creado');
  }

  console.log('');
  console.log('=== REPARTIDOR CREADO EXITOSAMENTE ===');
  console.log('Nombre:   Alexander Rivera Pabon');
  console.log('Email:    ' + email);
  console.log('Password: ' + password);
  console.log('Teléfono: ' + phone);
  console.log('Vehículo: Moto (ABC123)');
  console.log('CC:       1193042104');
  console.log('');
  console.log('El repartidor puede cambiar sus datos desde Perfil > Configuraciones.');
  console.log('El admin puede gestionar desde Admin > Repartidores.');
}
main();
