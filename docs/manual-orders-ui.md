# Interfaz de pedidos manuales

## Panel del negocio

La acción **Crear pedido manual** aparece en el menú y en `/negocio/pedidos`. El negocio queda fijado a la cuenta autenticada. El flujo permite buscar clientes anteriores, usar invitado, seleccionar sucursal, productos y variantes, guardar borrador, calcular y confirmar.

## Panel administrativo

La acción aparece en `/admin/pedidos`. Administración selecciona negocio, sucursal, excepción, ajustes, estado y repartidor. Las advertencias no se omiten silenciosamente; requieren motivo cuando la regla permite continuar.

## Accesibilidad y móvil

- Labels visibles.
- Botones con estados deshabilitados.
- Indicadores de carga.
- Mensajes comprensibles.
- Resumen adaptable y barra de acciones móvil.
- Navegación por teclado en campos, listas y botones.
- Advertencia antes de cerrar una página con cambios sin guardar.

## Borradores

Los borradores recientes aparecen al inicio. Reanudar restaura campos e artículos; eliminar marca el registro como eliminado. Guardar usa versión optimista para no sobrescribir cambios de otra sesión.
