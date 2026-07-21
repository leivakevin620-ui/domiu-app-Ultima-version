# Runbook

1. Confirmar salud de Supabase y Vercel.
2. Filtrar logs por `/api/manual-orders`.
3. Identificar código HTTP y código estable.
4. Consultar audit log por actor/fecha, sin copiar PII.
5. Consultar pedido y movimientos.
6. No repetir confirmación con nueva clave si existe incertidumbre; verificar primero idempotencia.
7. Corregir código o configuración.
8. Desplegar, verificar y documentar.
