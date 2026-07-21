# Despliegue

1. Abrir PR y esperar CI.
2. Validar preview de Vercel.
3. Reconstruir Supabase desde cero.
4. Aplicar migraciones a producción en orden.
5. Fusionar mediante squash.
6. Esperar deployment productivo `READY`.
7. Consultar `/api/health`.
8. Revisar logs 5xx.
9. Probar creación controlada e idempotencia.
10. Registrar commit, deployment y resultado.

No aplicar migraciones a producción antes de compilar el commit exacto que las consume.
