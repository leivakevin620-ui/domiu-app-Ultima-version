# Flujo operativo de un pedido manual

```text
Actor autenticado
  → selecciona tenant/negocio autorizado
  → selecciona sucursal
  → vincula cliente o captura invitado
  → define domicilio o pickup
  → añade productos autorizados
  → backend cotiza con catálogo y configuración vigentes
  → usuario revisa advertencias y confirma
  → PostgreSQL bloquea inventario
  → valida otra vez precio, stock, actor y tenant
  → crea order y order_items con snapshots
  → registra movimientos, tracking y auditoría
  → triggers existentes calculan finanzas y notifican
  → pedido continúa por estados normales
```

La cotización no reserva inventario. La confirmación es el único punto que descuenta stock. La cancelación restaura movimientos registrados una sola vez.
