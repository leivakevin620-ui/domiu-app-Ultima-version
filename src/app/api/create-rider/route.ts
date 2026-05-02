import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Service role key no configurada" }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const body = await req.json();
    const { email, password, nombre, telefono, documento, vehiculo, placa } = body;

    if (!email || !password || !nombre) {
      return NextResponse.json({ error: "Email, contraseña y nombre son obligatorios" }, { status: 400 });
    }

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, rol: "repartidor", telefono, documento, vehiculo, placa },
    });

    if (authError) {
      if (authError.message.includes("already")) {
        return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
      }
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const userId = authData.user.id;

    // 2. El trigger handle_new_user ya crea el perfil automaticamente

    // 3. Crear repartidor
    const { error: riderError } = await supabase
      .from("repartidores")
      .insert({
        user_id: userId,
        nombre,
        telefono: telefono || null,
        documento: documento || null,
        vehiculo: vehiculo || null,
        placa: placa || null,
        estado: "No disponible",
      });

    if (riderError) {
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Error creando repartidor: " + riderError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId, message: "Repartidor creado exitosamente" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
