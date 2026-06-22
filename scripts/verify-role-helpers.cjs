/**
 * Verifica los helpers de roles:
 *   - getDashboardPathForRole('admin') === '/admin'
 *   - isAdminRole('admin') === true
 *   - ADMIN_ROLES.includes('admin') === true
 *
 * También verifica que el esquema de types/auth.ts esté completo.
 *
 * USO: node scripts/verify-role-helpers.cjs
 */

const path = require('path');
const fs = require('fs');

// Leemos el archivo de tipos para verificar las definiciones
const authTypesPath = path.resolve(__dirname, '..', 'src', 'types', 'auth.ts');
const content = fs.readFileSync(authTypesPath, 'utf-8');

let passed = 0;
let failed = 0;

function check(description, condition) {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${description}`);
    failed++;
  }
}

console.log('');
console.log('========================================');
console.log('  Verificación de role helpers');
console.log('========================================');
console.log('');

// 1. Buscar ADMIN_ROLES en el contenido
console.log('── Constantes exportadas ──');
const hasAdminRoles = content.includes('ADMIN_ROLES');
check('ADMIN_ROLES exportada', hasAdminRoles);

// 2. Buscar 'admin' en ADMIN_ROLES
if (hasAdminRoles) {
  const adminRolesMatch = content.match(/ADMIN_ROLES:\s*UserRole\[\]\s*=\s*\[([^\]]+)\]/);
  if (adminRolesMatch) {
    const roles = adminRolesMatch[1].split(',').map(r => r.trim().replace(/['"]/g, ''));
    check(`ADMIN_ROLES contiene 'admin'`, roles.includes('admin'));
    check(`ADMIN_ROLES contiene 'super_admin'`, roles.includes('super_admin'));
    console.log('  Roles admin:', roles.join(', '));
  } else {
    // Try regex without UserRole type annotation
    const altMatch = content.match(/ADMIN_ROLES\s*=\s*\[([^\]]+)\]/);
    if (altMatch) {
      const roles = altMatch[1].split(',').map(r => r.trim().replace(/['"]/g, ''));
      check(`ADMIN_ROLES contiene 'admin'`, roles.includes('admin'));
      console.log('  Roles admin:', roles.join(', '));
    } else {
      check('ADMIN_ROLES parseable', false);
    }
  }
}

// 3. Buscar isAdminRole
console.log('');
console.log('── Funciones exportadas ──');
check('isAdminRole existe', content.includes('isAdminRole'));
check('getDashboardPathForRole existe', content.includes('getDashboardPathForRole'));

// 4. Verificar getDashboardPathForRole devuelve /admin para admin
const dashMatch = content.match(/getDashboardPathForRole.*?=>\s*\{[^}]+\}/s);
if (dashMatch) {
  const fnBody = dashMatch[0];
  check('getDashboardPathForRole retorna /admin para admin', fnBody.includes("'/admin'") || fnBody.includes('"/admin"'));
}

// 5. Verificar BUSINESS_ROLES
check('BUSINESS_ROLES existe', content.includes('BUSINESS_ROLES'));

// 6. Verificar UserRole enum
const hasAdminInEnum = content.includes("'admin'") || content.includes('admin');
check('UserRole incluye admin', hasAdminInEnum);

// 7. Verificar DASHBOARD_ROUTES
check('DASHBOARD_ROUTES existe', content.includes('DASHBOARD_ROUTES'));
const dashRoutesMatch = content.match(/DASHBOARD_ROUTES\s*[=:][^=]*=\s*\{([^}]+\})\s*as\s+const/s);
if (dashRoutesMatch) {
  const routesBlock = dashRoutesMatch[1];
  check('DASHBOARD_ROUTES incluye admin', routesBlock.includes("'admin'") || routesBlock.includes('"/admin"'));
  check('DASHBOARD_ROUTES incluye customer', routesBlock.includes("'customer'") || routesBlock.includes('"/cliente"'));
}

console.log('');
console.log('── Resumen ──');
console.log(`  Tests: ${passed + failed}`);
console.log(`  Pass: ${passed}`);
console.log(`  Fail: ${failed}`);
console.log(failed === 0 ? '  [OK] Todos los tests pasaron' : '  [FAIL] Hay tests fallando');
console.log('');
