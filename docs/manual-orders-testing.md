# Pruebas de pedidos manuales

## Automatizadas

```bash
npm ci
npx vitest run src/test/manual-orders-schema.test.ts
npx vitest run src/test/manual-orders-architecture.test.ts
npm audit --audit-level=high
npm run build
```

## Casos críticos

### Comercio

1. Abrir `/negocio/pedidos/crear`.
2. Confirmar que el negocio no puede cambiarse.
3. Buscar un cliente anterior o continuar como invitado.
4. Agregar productos del catálogo propio.
5. Intentar confirmar con producto agotado.
6. Guardar, recargar y reanudar un borrador.
7. Calcular y confirmar.
8. Verificar distintivo Manual en `/negocio/pedidos`.

### Administración

1. Abrir `/admin/pedidos/crear`.
2. Cambiar de negocio y confirmar que el catálogo se reemplaza.
3. Crear pedido para invitado.
4. Probar domicilio y pickup.
5. Asignar repartidor disponible.
6. Probar ajuste con motivo.
7. Confirmar y verificar el pedido en `/admin/pedidos`.

### Idempotencia

Enviar dos veces la confirmación con la misma clave y cuerpo. Debe existir un solo pedido. Repetir la clave con contenido diferente debe devolver conflicto.

### Inventario

Confirmar dos pedidos concurrentes para el último stock. Solo uno debe finalizar. Cancelar un pedido manual confirmado y verificar una sola restauración.

### Seguridad

- Comercio modifica `businessId` hacia otro tenant: 403.
- Cliente o repartidor llama la API directamente: 403.
- Solicitud cross-site: 403.
- Precio o total falsificado: ignorado o rechazado por esquema.
- Producto de otro negocio: rechazo.
- `created_by` falsificado: no existe en el contrato; se deriva de sesión.
- Borrador ajeno: no visible ni modificable.
- Repartidor no debe recibir `internal_notes`.

## Evidencia de despliegue

Registrar commit, run de CI, deployment de Vercel, resultado de migraciones, `/api/health`, logs y resultado de una creación controlada. No usar datos reales de clientes para pruebas.
