const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vuwaqmwgvldqmmgkpyjh.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1d2FxbXdndmxkcW1tZ2tweWpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTY0ODQwOSwiZXhwIjoyMDk3MjI0NDA5fQ.8pKaY1nPt8ubb2Nzs010KYEDA6hjHQSfi28f3uQfk3k';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  {
    email: 'carlos@cevicheria.com',
    password: 'demo1234',
    user_metadata: { firstName: 'Carlos', lastName: 'Méndez' },
  },
  {
    email: 'maria@heladeria.com',
    password: 'demo1234',
    user_metadata: { firstName: 'María', lastName: 'García' },
  },
  {
    email: 'juan@pizzeria.com',
    password: 'demo1234',
    user_metadata: { firstName: 'Juan', lastName: 'Pérez' },
  },
  {
    email: 'carlos.mendoza@courier.com',
    password: 'demo1234',
    user_metadata: { firstName: 'Carlos', lastName: 'Mendoza' },
  },
  {
    email: 'andrea@courier.com',
    password: 'demo1234',
    user_metadata: { firstName: 'Andrea', lastName: 'López' },
  },
  {
    email: 'javier@courier.com',
    password: 'demo1234',
    user_metadata: { firstName: 'Javier', lastName: 'Ramírez' },
  },
  {
    email: 'laura@courier.com',
    password: 'demo1234',
    user_metadata: { firstName: 'Laura', lastName: 'Castro' },
  },
  {
    email: 'jose@courier.com',
    password: 'demo1234',
    user_metadata: { firstName: 'José', lastName: 'Torres' },
  },
];

async function main() {
  for (const u of USERS) {
    const { data: existingList, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error(`✗ Failed to list users: ${listError.message}`);
      continue;
    }

    const existingUser = existingList.users.find((usr) => usr.email === u.email);

    if (existingUser) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: u.password, email_confirm: true }
      );
      if (updateError) {
        console.error(`✗ ${u.email} — failed to update password: ${updateError.message}`);
      } else {
        console.log(`✓ ${u.email} — password reset to demo1234 (id: ${existingUser.id})`);
      }
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: u.user_metadata,
      });

      if (error) {
        console.error(`✗ ${u.email} — ${error.message}`);
      } else {
        console.log(`✓ ${u.email} — created (id: ${data.user.id})`);
      }
    }
  }

  console.log('\nDone');
}

main().catch(console.error);
