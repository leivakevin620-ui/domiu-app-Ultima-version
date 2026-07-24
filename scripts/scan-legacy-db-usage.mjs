import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOTS = ["src", "scripts"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const entries = [];
const tables = new Map();
const rpcs = new Map();

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (EXTENSIONS.has(extname(entry.name))) scan(full);
  }
}

function add(map, key, item) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(item);
}

function scan(file) {
  const source = readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const match of line.matchAll(/\.from\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
      const item = { file: relative(".", file), line: index + 1, text: line.trim().slice(0, 300) };
      entries.push({ kind: "table", name: match[1], ...item });
      add(tables, match[1], item);
    }
    for (const match of line.matchAll(/\.rpc\(\s*["'`]([^"'`]+)["'`]/g)) {
      const item = { file: relative(".", file), line: index + 1, text: line.trim().slice(0, 300) };
      entries.push({ kind: "rpc", name: match[1], ...item });
      add(rpcs, match[1], item);
    }
  }
}

for (const root of ROOTS) walk(root);
mkdirSync("public", { recursive: true });
writeFileSync("public/legacy-db-usage.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  tables: Object.fromEntries([...tables.entries()].sort(([a], [b]) => a.localeCompare(b))),
  rpcs: Object.fromEntries([...rpcs.entries()].sort(([a], [b]) => a.localeCompare(b))),
  entries,
}, null, 2));
console.log(`Inventario DB generado: ${tables.size} tablas, ${rpcs.size} RPC.`);
