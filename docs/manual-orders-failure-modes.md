# Modos de fallo

- Negocio cerrado: bloqueo o excepción administrativa.
- Sucursal inactiva: bloqueo o excepción administrativa.
- Producto agotado/inactivo: bloqueo.
- Precio cambiado: cotización o confirmación usa el nuevo valor.
- Stock concurrente: una confirmación falla y debe recalcular.
- Sin coordenadas: tarifa base y advertencia.
- Notificación fallida: investigar trigger sin duplicar pedido.
- Timeout: reintentar con la misma clave.
- Borrador modificado: conflicto de versión.
