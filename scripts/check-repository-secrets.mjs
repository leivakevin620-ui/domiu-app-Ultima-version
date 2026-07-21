import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
  encoding: 'utf8',
}).split('\0').filter(Boolean);

function isEnvironmentTemplate(file) {
  const name = file.split('/').at(-1) || '';
  return name.startsWith('.env') && name.endsWith('.example');
}

const environmentFiles = trackedFiles.filter((file) => {
  const name = file.split('/').at(-1) || '';
  return name.startsWith('.env') && !isEnvironmentTemplate(file);
});

if (environmentFiles.length > 0) {
  console.error('Hay archivos de entorno versionados:');
  for (const file of environmentFiles) console.error(`- ${file}`);
  process.exit(1);
}

const privateAssignment = /\b(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|VERCEL_OIDC_TOKEN)\s*=\s*["'][^"'\r\n]+["']/;
const opaqueSecretKey = /\bsb_secret_[A-Za-z0-9_-]{20,}\b/;
const ignoredExtensions = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|eot|mp4|mov)$/i;
const ignoredPaths = /^(docs\/|public\/|\.next\/|node_modules\/)/;
const findings = [];

for (const file of trackedFiles) {
  if (isEnvironmentTemplate(file) || ignoredExtensions.test(file) || ignoredPaths.test(file)) continue;
  let stats;
  try {
    stats = statSync(file);
  } catch {
    continue;
  }
  if (!stats.isFile() || stats.size > 2_000_000) continue;

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const assignmentMatch = content.match(privateAssignment);
  if (assignmentMatch) {
    findings.push(`${file}: asignación privada ${assignmentMatch[1]}`);
    continue;
  }

  if (file !== 'scripts/check-repository-secrets.mjs' && opaqueSecretKey.test(content)) {
    findings.push(`${file}: posible clave sb_secret incrustada`);
  }
}

if (findings.length > 0) {
  console.error('Se detectaron posibles secretos en archivos versionados:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Escaneo completado: ${trackedFiles.length} archivos versionados sin secretos privados detectados.`);
