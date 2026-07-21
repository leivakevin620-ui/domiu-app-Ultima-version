# Matriz de seguridad

| Caso | Resultado esperado |
|---|---|
| Comercio cambia `businessId` | 403 o rechazo SQL |
| Producto de otro negocio | 400 |
| Creador falsificado | Ignorado; actor desde sesión |
| Total falsificado | Ignorado |
| Cliente por teléfono | Sin vínculo automático |
| Cross-site POST | 403 |
| Doble confirmación | Mismo pedido |
| Misma clave, otro cuerpo | 409 |
| Stock simultáneo | Una transacción gana |
| Borrador ajeno | 404/403 |
| Función RPC como authenticated | Sin permiso |
