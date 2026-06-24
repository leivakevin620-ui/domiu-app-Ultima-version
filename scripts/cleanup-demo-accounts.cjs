#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      process.env[key] = val;
    }
  }
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function del(table, filter) {
  const { error } = await supabase.from(table).delete().match(filter);
  if (error && !error.message.includes('0 rows')) {
    console.error(`    ⚠ ${table}: ${error.message}`);
    return false;
  }
  return true;
}

async function main() {
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const remaining = (usersData?.users || []).filter(u =>
    u.email?.toLowerCase() !== 'domiumagdalena@gmail.com'
  );

  if (remaining.length === 0) {
    console.log('TODO LIMPIO - No quedan usuarios por eliminar.');
    return;
  }

  console.log(`Eliminando ${remaining.length} usuarios restantes...\n`);

  for (const u of remaining) {
    const { id: uid, email } = u;
    console.log(`Procesando ${email}...`);

    // Step 1: Get user's businesses
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', uid);
    const bizIds = (businesses || []).map(b => b.id);

    if (bizIds.length > 0) {
      // Step 2: Delete orders FOR those businesses (from any customer)
      for (const bid of bizIds) {
        const { data: orderIds } = await supabase
          .from('orders')
          .select('id')
          .eq('business_id', bid);
        const oids = (orderIds || []).map(o => o.id);

        for (const oid of oids) {
          await del('order_tracking', { order_id: oid });
          await del('driver_locations', { order_id: oid });
          await del('ratings', { order_id: oid });
          await del('order_items', { order_id: oid });
          await del('orders', { id: oid });
        }
      }

      // Step 3: Delete business-related data
      for (const bid of bizIds) {
        const { data: pids } = await supabase
          .from('products')
          .select('id')
          .eq('business_id', bid);
        for (const p of (pids || [])) {
          await del('product_images', { product_id: p.id });
          await del('product_variants', { product_id: p.id });
        }
        await del('products', { business_id: bid });
        await del('business_hours', { business_id: bid });
        await del('business_addresses', { business_id: bid });
        await del('business_payouts', { business_id: bid });
        await del('businesses', { id: bid });
      }
    }

    // Step 4: Delete user's orders as customer
    const { data: orderIds2 } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_id', uid);
    for (const o of (orderIds2 || [])) {
      await del('order_tracking', { order_id: o.id });
      await del('driver_locations', { order_id: o.id });
      await del('ratings', { order_id: o.id });
      await del('order_items', { order_id: o.id });
      await del('orders', { id: o.id });
    }

    // Step 5: Delete all other user-related data
    await del('customer_favorites', { user_id: uid });
    await del('customer_payment_methods', { user_id: uid });
    await del('notification_preferences', { user_id: uid });
    await del('notifications', { recipient_id: uid });
    await del('device_tokens', { user_id: uid });
    await del('coupon_usage', { user_id: uid });
    await del('referrals', { referrer_id: uid });
    await del('loyalty_points', { user_id: uid });
    await del('reward_redemptions', { user_id: uid });
    await del('ratings', { rater_id: uid });
    await del('rating_comments', { author_id: uid });
    await del('rating_reactions', { user_id: uid });
    await del('review_reports', { reporter_id: uid });
    await del('chats', { participant_1_id: uid });
    await del('chats', { participant_2_id: uid });
    await del('messages', { sender_id: uid });
    await del('messages', { receiver_id: uid });
    await del('group_chat_members', { member_id: uid });
    await del('group_messages', { sender_id: uid });
    // group_chats has ON DELETE RESTRICT on created_by → must delete first
    const { data: groupChats } = await supabase.from('group_chats').select('id').eq('created_by', uid);
    for (const gc of (groupChats || [])) {
      await del('group_chat_members', { group_chat_id: gc.id });
      await del('group_messages', { group_chat_id: gc.id });
      await del('group_chats', { id: gc.id });
    }
    await del('addresses', { user_id: uid });
    await del('driver_earnings', { driver_id: uid });
    await del('driver_locations', { driver_id: uid });
    await del('driver_availability', { driver_id: uid });
    await del('drivers', { id: uid });
    // wallet_transactions cascade via wallets(id) ON DELETE CASCADE
    await del('wallets', { user_id: uid });
    await del('admin_sessions', { admin_id: uid });
    await del('admin_history', { admin_id: uid });
    await del('admin_audit_log', { admin_id: uid });
    await del('audit_log', { user_id: uid });

    // Step 6: Delete the auth user (now cascade should work)
    const { error } = await supabase.auth.admin.deleteUser(uid);
    if (error) {
      console.error(`  ✗ ${email}: ${error.message}`);
    } else {
      console.log(`  ✓ ${email} eliminado`);
    }
  }

  // Final verification
  const { data: finalUsers } = await supabase.auth.admin.listUsers();
  const final = (finalUsers?.users || []).filter(u =>
    u.email?.toLowerCase() !== 'domiumagdalena@gmail.com'
  );
  console.log(`\n${'='.repeat(50)}`);
  if (final.length === 0) {
    console.log('RESULTADO: Todos los usuarios demo eliminados exitosamente.');
    console.log('Solo queda: domiumagdalena@gmail.com (admin)');
  } else {
    console.log(`Quedan ${final.length} usuarios pendientes:`);
    for (const u of final) console.log(`  - ${u.email}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
