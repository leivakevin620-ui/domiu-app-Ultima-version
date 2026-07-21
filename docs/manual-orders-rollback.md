# Rollback

El rollback primario es revertir el despliegue de Vercel. No eliminar tablas o columnas cuando ya existen pedidos manuales.

Para desactivar:

1. retirar enlaces de creación;
2. bloquear temporalmente APIs de escritura;
3. conservar lectura, pedidos, snapshots, movimientos y auditoría;
4. corregir y desplegar una nueva versión.

Una restauración de inventario debe seguir reglas de cancelación; no ejecutar actualizaciones masivas sin reconciliar movimientos.
