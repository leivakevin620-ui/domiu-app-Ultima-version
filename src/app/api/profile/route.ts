import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/db/supabase';

async function getUserFromToken(req: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { userId: user.id };
}

export async function GET(req: NextRequest) {
  const auth = await getUserFromToken(req);
  if (!auth) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const serviceClient = getServiceClient();
  const { data: profile, error } = await serviceClient
    .from('profiles')
    .select('*')
    .eq('id', auth.userId)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile });
}

export async function PATCH(req: NextRequest) {
  const auth = await getUserFromToken(req);
  if (!auth) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  const updates = await req.json();
  const serviceClient = getServiceClient();
  const { data: profile, error } = await serviceClient
    .from('profiles')
    .update(updates)
    .eq('id', auth.userId)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile });
}
