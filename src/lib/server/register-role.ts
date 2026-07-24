import { createClient } from "@supabase/supabase-js";

export type AppRole = "admin" | "financiero" | "repartidor" | "negocio";

export type RegisterRoleInput = {
  rol: AppRole;
  email: string;
  password: string;
  nombre: string;
  telefono?: string;
  documento?: string;
  vehiculo?: string;
  placa?: string;
  categoria?: string;
  accessCode?: string;
};

export type RegisterRoleResult = {
  status: number;
  body: Record<string, unknown>;
};

const VALID_ROLES = new Set<AppRole>(["admin", "financiero", "repartidor", "negocio"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("El servidor no tiene configurada la conexión administrativa");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function forceLegacyProfile(
  supabase: ReturnType<typeof createClient>,
  profile: { id: string; email: string; nombre: string; telefono: string; rol: AppRole },
) {
  const fullPayload = {
    id: profile.id,
    email: profile.email,
    nombre: profile.nombre,
    telefono: profile.telefono || null,
    rol: profile.rol,
  };

  let result = await supabase.from("profiles").upsert(fullPayload, { onConflict: "id" });
  if (!result.error) return;

  result = await supabase.from("profiles").upsert({
    id: profile.id,
    email: profile.email,
    nombre: profile.nombre,
    rol: profile.rol,
  }, { onConflict: "id" });

  if (result.error) throw result.error;
}

async function ensureRider(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  input: Required<Pick<RegisterRoleInput, "nombre">> & Partial<RegisterRoleInput>,
) {
  const payload = {
    user_id: userId,
    nombre: clean(input.nombre),
    telefono: clean(input.telefono) || null,
    documento: clean(input.documento) || null,
    vehiculo: clean(input.vehiculo) || null,
    placa: clean(input.placa) || null,
    estado: "No disponible",
    activo: true,
  };

  const { data: existing, error: findError } = await supabase
    .from("repartidores")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (findError) throw findError;

  const result = existing
    ? await supabase.from("repartidores").update(payload).eq("id", existing.id)
    : await supabase.from("repartidores").insert(payload);
  if (result.error) throw result.error;
}

async function ensureBusiness(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  input: Required<Pick<RegisterRoleInput, "nombre">> & Partial<RegisterRoleInput>,
) {
  const payload = {
    usuario_id: userId,
    nombre: clean(input.nombre),
    telefono: clean(input.telefono) || null,
    categoria: clean(input.categoria) || "General",
    abierto: true,
    activo: true,
  };

  const { data: existing, error: findError } = await supabase
    .from("negocios")
    .select("id")
    .eq("usuario_id", userId)
    .maybeSingle();
  if (findError) throw findError;

  const result = existing
    ? await supabase.from("negocios").update(payload).eq("id", existing.id)
    : await supabase.from("negocios").insert(payload);
  if (result.error) throw result.error;
}

export async function registerRoleUser(rawInput: RegisterRoleInput): Promise<RegisterRoleResult> {
  const input: RegisterRoleInput = {
    rol: clean(rawInput.rol) as AppRole,
    email: clean(rawInput.email).toLowerCase(),
    password: clean(rawInput.password),
    nombre: clean(rawInput.nombre),
    telefono: clean(rawInput.telefono),
    documento: clean(rawInput.documento),
    vehiculo: clean(rawInput.vehiculo),
    placa: clean(rawInput.placa),
    categoria: clean(rawInput.categoria),
    accessCode: clean(rawInput.accessCode),
  };

  if (!VALID_ROLES.has(input.rol)) {
    return { status: 400, body: { error: "Selecciona un rol válido" } };
  }
  if (!input.email || !input.email.includes("@") || !input.password || input.password.length < 6 || !input.nombre) {
    return {
      status: 400,
      body: { error: "Nombre, email y contraseña de mínimo 6 caracteres son obligatorios" },
    };
  }

  if (input.rol === "admin" || input.rol === "financiero") {
    const validCode = process.env.ADMIN_ACCESS_CODE || process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE;
    if (!validCode || input.accessCode !== validCode) {
      return { status: 403, body: { error: "Código de acceso inválido" } };
    }
  }

  const supabase = getAdminClient();
  let createdUserId = "";

  try {
    const metadata = {
      nombre: input.nombre,
      rol: input.rol,
      telefono: input.telefono || "",
      documento: input.documento || "",
      vehiculo: input.vehiculo || "",
      placa: input.placa || "",
      categoria: input.categoria || "",
    };

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: metadata,
      app_metadata: { rol: input.rol },
    });

    if (authError) {
      const duplicate = /already|registered|exists/i.test(authError.message || "");
      return {
        status: duplicate ? 409 : 400,
        body: { error: duplicate ? "Ya existe un usuario con ese correo" : authError.message },
      };
    }
    if (!authData.user) throw new Error("Supabase no devolvió el usuario creado");
    createdUserId = authData.user.id;

    await forceLegacyProfile(supabase, {
      id: createdUserId,
      email: input.email,
      nombre: input.nombre,
      telefono: input.telefono || "",
      rol: input.rol,
    });

    await supabase.auth.admin.updateUserById(createdUserId, {
      user_metadata: metadata,
      app_metadata: { rol: input.rol },
    });

    if (input.rol === "repartidor") {
      await ensureRider(supabase, createdUserId, input);
    } else if (input.rol === "negocio") {
      await ensureBusiness(supabase, createdUserId, input);
    }

    const { data: profile, error: verifyError } = await supabase
      .from("profiles")
      .select("id, rol")
      .eq("id", createdUserId)
      .single();
    if (verifyError) throw verifyError;
    if (profile.rol !== input.rol) {
      throw new Error(`El perfil fue creado como ${profile.rol}, no como ${input.rol}`);
    }

    return {
      status: 201,
      body: {
        success: true,
        userId: createdUserId,
        rol: profile.rol,
        message: `Usuario creado correctamente con rol ${profile.rol}`,
      },
    };
  } catch (error: any) {
    if (createdUserId) {
      try {
        await supabase.auth.admin.deleteUser(createdUserId);
      } catch {
        // Mantener el error original.
      }
    }
    console.error("[register-role]", error);
    return {
      status: 500,
      body: { error: error?.message || "No fue posible crear el usuario" },
    };
  }
}
