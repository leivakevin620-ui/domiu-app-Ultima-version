import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const ACTIVE_URL = JSON.stringify("https://muikwpjyaojeolwcuvqf.supabase.co");
const ACTIVE_ANON_KEY = JSON.stringify("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11aWt3cGp5YW9qZW9sd2N1dnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NDc5NjIsImV4cCI6MjEwMDIyMzk2Mn0.Ly8OUPkvy1HV2gCu-QDeXFVGegLGRzBYU-N19GeYyQc");
const SOURCE_ROOT = "src";
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

let changedFiles = 0;

function patchFile(path) {
  const original = readFileSync(path, "utf8");
  const patched = original
    .replace(/process\.env\.NEXT_PUBLIC_SUPABASE_URL!?/g, ACTIVE_URL)
    .replace(/process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY!?/g, ACTIVE_ANON_KEY)
    // Las rutas de datos heredadas usan esta variable, pero las tablas de
    // compatibilidad tienen permisos explícitos para anon/authenticated.
    // Las operaciones administrativas de Auth se delegan a una Edge Function.
    .replace(/process\.env\.SUPABASE_SERVICE_ROLE_KEY!?/g, ACTIVE_ANON_KEY);

  if (patched !== original) {
    writeFileSync(path, patched);
    changedFiles += 1;
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (EXTENSIONS.has(extname(entry.name))) patchFile(fullPath);
  }
}

walk(SOURCE_ROOT);
console.log(`[active-supabase] ${changedFiles} archivos conectados al proyecto gratuito activo.`);
