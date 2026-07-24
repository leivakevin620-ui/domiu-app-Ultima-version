import { readFileSync, writeFileSync } from "node:fs";

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`No se encontró el inicio: ${label}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`No se encontró el final: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const adminPath = "src/components/AdminApp.tsx";
let admin = readFileSync(adminPath, "utf8");

admin = replaceRange(
  admin,
  "  const descargarDesprendible = async (repId: string) => {",
  "\n  const colPedidos = [",
  `  const descargarDesprendible = (repId: string) => {
    const rep = reps.find((r: any) => r.id === repId);
    if (!rep) return fail("Repartidor no encontrado");

    const params = new URLSearchParams({ repId, v: "20260724-2" });
    if (turnoActivo?.id) params.set("turnoId", turnoActivo.id);
    const url = \`/api/admin/desprendible?\${params.toString()}\`;

    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.target = "_blank";
    enlace.rel = "noopener noreferrer";
    enlace.style.display = "none";
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    ok("Generando desprendible PDF...");
  };
`,
  "generador servidor del desprendible",
);

admin = admin.replace(
  /<button[^>]*onClick=\{\(\) => descargarDesprendible\(l\.rep\.id\)\}[^>]*><FileDown size=\{14\} \/><\/button>/,
  `<button type="button" onClick={() => descargarDesprendible(l.rep.id)} disabled={l.count === 0} title={l.count === 0 ? "Sin domicilios entregados" : "Descargar desprendible PDF"} aria-label={\`Descargar desprendible de \${l.rep.nombre}\`} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-bold disabled:opacity-30 hover:bg-red-500/20 border border-red-500/20"><FileDown size={14} /></button>`,
);

admin = admin.replace('fetch("/api/create-rider", {', 'fetch("/api/register-role", {');
admin = admin.replace(
  'body: JSON.stringify({ email: rEmail.trim(), password: rPass, nombre: rNom.trim(), telefono: rTel.trim(), documento: rDoc.trim(), vehiculo: rVeh.trim(), placa: rPla.trim() }),',
  'body: JSON.stringify({ rol: "repartidor", email: rEmail.trim(), password: rPass, nombre: rNom.trim(), telefono: rTel.trim(), documento: rDoc.trim(), vehiculo: rVeh.trim(), placa: rPla.trim() }),',
);
writeFileSync(adminPath, admin, "utf8");

const loginPath = "src/app/login/page.tsx";
let login = readFileSync(loginPath, "utf8");
login = login.replace(
  'const { login, registerAdmin, registerRepartidor, registerNegocio, registerFinanciero, loading } = useAuth();',
  'const { login, loading } = useAuth();',
);

const registrationBlock = `      if (isRegister) {
        const res = await fetch("/api/register-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            rol,
            email,
            password,
            nombre,
            telefono,
            documento,
            vehiculo,
            placa,
            categoria,
            accessCode,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No fue posible crear el usuario");
        if (data.rol !== rol) throw new Error(\`El servidor creó el rol \${data.rol}, no \${rol}\`);

        const label = rol === "repartidor"
          ? "Repartidor"
          : rol === "negocio"
            ? "Negocio"
            : rol === "financiero"
              ? "Cuenta financiera"
              : "Cuenta administrativa";
        setError(\`\${label} creado correctamente con rol \${data.rol}. Ahora inicia sesión.\`);
        setSubmitLoading(false);
      } else {
`;

login = replaceRange(
  login,
  "      if (isRegister) {",
  "        const result = await login(email, password);",
  registrationBlock,
  "registro por rol",
);
writeFileSync(loginPath, login, "utf8");

const authPath = "src/hooks/useAuth.ts";
let auth = readFileSync(authPath, "utf8");
auth = auth.replaceAll('let rol: UserProfile["rol"] = "admin";', 'let rol: UserProfile["rol"] = "cliente";');
writeFileSync(authPath, auth, "utf8");

console.log("Roles y desprendibles v2 aplicados correctamente.");
