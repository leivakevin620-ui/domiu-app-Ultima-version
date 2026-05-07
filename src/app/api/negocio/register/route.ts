import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  try {
    if (!serviceKey) {
      return NextResponse.json({ error: "Servidor no configurado" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { email, password, nombre, telefono, categoria } = body;

    if (!email || !password || !nombre || !telefono || !categoria) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    // Crear usuario en Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre, rol: "negocio", telefono, categoria },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("No se pudo crear el usuario");

    // Crear perfil
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      email,
      nombre,
      rol: "negocio",
    });
    if (profileError) throw profileError;

    // Crear negocio vinculado al usuario
    const { data: negocio, error: negocioError } = await supabase
      .from("negocios")
      .insert({
        nombre,
        categoria,
        telefono,
        usuario_id: authData.user.id,
        abierto: true,
        activo: true,
      })
      .select("id")
      .single();

    if (negocioError) throw negocioError;

    return NextResponse.json({ success: true, userId: authData.user.id, negocioId: negocio.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
