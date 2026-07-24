import { cookies } from "next/headers";

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

const ACTIVE_SUPABASE_URL = "https://muikwpjyaojeolwcuvqf.supabase.co";
const ACTIVE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11aWt3cGp5YW9qZW9sd2N1dnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NDc5NjIsImV4cCI6MjEwMDIyMzk2Mn0.Ly8OUPkvy1HV2gCu-QDeXFVGegLGRzBYU-N19GeYyQc";
const VALID_ROLES = new Set<AppRole>(["admin", "financiero", "repartidor", "negocio"]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
    return { status: 400, body: { error: "Nombre, email y contraseña de mínimo 6 caracteres son obligatorios" } };
  }

  if (input.rol === "admin" || input.rol === "financiero") {
    const validCode = process.env.ADMIN_ACCESS_CODE || process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE;
    if (!validCode || input.accessCode !== validCode) {
      return { status: 403, body: { error: "Código de acceso inválido" } };
    }
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("domiu-access-token")?.value;
  if (!token) {
    return { status: 401, body: { error: "Tu sesión administrativa venció. Vuelve a iniciar sesión." } };
  }

  try {
    const response = await fetch(`${ACTIVE_SUPABASE_URL}/functions/v1/legacy-user-admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ACTIVE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "create", ...input }),
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({ error: "La función administrativa no respondió correctamente" }));
    return { status: response.status, body };
  } catch (error: any) {
    return {
      status: 502,
      body: { error: error?.message || "No fue posible contactar el servicio administrativo" },
    };
  }
}
