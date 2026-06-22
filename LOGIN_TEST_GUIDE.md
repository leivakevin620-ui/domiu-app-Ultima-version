# Guía de Prueba — Flujo de Autenticación

## Prerrequisitos

- Servidor local ejecutándose (`npm run dev`)
- Variables de entorno configuradas (`.env.local` con Supabase)
- Consola del navegador abierta (para ver logs `[Auth]` y `[API Profile]` en dev)

---

## 1. Registro de cliente nuevo

1. Ir a `/register`
2. Seleccionar rol **Cliente**
3. Llenar: nombre, apellido, email nuevo, contraseña (≥6 chars)
4. Enviar formulario
5. ✅ Ver pantalla de éxito **"Registro exitoso"**
6. ✅ Ser redirigido a `/login` tras 2 segundos
7. ❌ NO debe aparecer error rojo

---

## 2. Registro con email pendiente de confirmación

1. Ir a `/register`
2. Usar un email real (para revisar bandeja)
3. Enviar formulario
4. ✅ Ver pantalla de éxito con mensaje "Revisa tu correo"
5. ✅ Revisar bandeja: debe haber email de confirmación de Supabase
6. ✅ En consola: `[Auth] register requires email confirmation`

---

## 3. Login de cliente

1. Ir a `/login`
2. Usar email + contraseña de cliente registrado
3. Enviar formulario
4. ✅ Ser redirigido a `/cliente`
5. ✅ En consola: `[Auth] login success`
6. ✅ Barra de navegación debe mostrar contenido de cliente

---

## 4. Login de administrador

Probar cada rol:

| Rol | Email de prueba |
|-----|----------------|
| super_admin | domiumagdalena@gmail.com |
| admin_general | admin.general@test.com |
| admin_financiero | admin.financiero@test.com |
| admin_operativo | admin.operativo@test.com |
| admin_comercial | admin.comercial@test.com |
| admin_soporte | admin.soporte@test.com |

1. Login con credenciales del admin
2. ✅ Ser redirigido a `/admin`
3. ✅ Ver panel de administración

---

## 5. Login de negocio

1. Login con credenciales de rol `merchant` o `business`
2. ✅ Ser redirigido a `/negocio`
3. ✅ Ver panel de negocio

---

## 6. Login de repartidor

1. Login con credenciales de rol `courier`
2. ✅ Ser redirigido a `/repartidor`
3. ✅ Ver panel de repartidor

---

## 7. Usuario con sesión pero sin perfil

Simular: eliminar el registro de `profiles` en Supabase para un usuario existente.

1. Hacer login (credenciales correctas)
2. ✅ Ver error: **"Perfil no encontrado. Contacta a soporte."**
3. ✅ El usuario no debe quedar logueado automáticamente
4. ❌ NO debe hacerse logout silencioso

---

## 8. Ruta protegida sin sesión

1. Cerrar sesión (o usar ventana de incógnito)
2. Navegar a `/cliente`, `/negocio`, `/repartidor`, o `/admin`
3. ✅ Ser redirigido a `/login` (o mostrar pantalla de login)
4. ❌ No debe mostrar contenido protegido

---

## 9. Redirección por rol desde `/`

1. Estando logueado, navegar a `/`
2. ✅ Ser redirigido al dashboard según el rol:
   - admin* → `/admin`
   - merchant/business → `/negocio`
   - courier → `/repartidor`
   - customer → `/cliente`

---

## 10. Logout

1. Estando logueado, hacer clic en "Cerrar sesión"
2. ✅ Ser redirigido a `/login` o landing
3. ✅ Intentar navegar a ruta protegida → debe redirigir a login
4. ✅ En consola: `[Auth] logout` (si hay log)

---

## 11. Login con errores específicos

| Escenario | Mensaje esperado |
|-----------|-----------------|
| Email no existe | "Credenciales incorrectas" |
| Contraseña incorrecta | "Credenciales incorrectas" |
| Email no confirmado | "Email no confirmado. Revisa tu bandeja de entrada." |
| Cuenta suspendida | "Cuenta suspendida. Contacta a soporte." |

---

## 12. Registro con rol de administrador (seguridad)

1. Intentar registrarse con rol `super_admin` desde `/register`
2. ❌ El POST a `/api/profile` debe rechazar con 403
3. Solo `domiumagdalena@gmail.com` puede crear admins

---

## Validaciones post-prueba

```bash
npm run lint          # 0 errors, 0 warnings
npm run build         # build OK
npm run test          # tests OK
npm run check:env     # sin críticos
```
