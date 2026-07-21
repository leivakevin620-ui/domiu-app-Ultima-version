# Borradores

Un borrador almacena un formulario incompleto con actor, rol, negocio, sucursal, payload, versión y vencimiento.

Operaciones:

- crear;
- reanudar;
- actualizar mediante versión optimista;
- eliminar lógicamente;
- convertir al confirmar.

No reserva stock, no crea pedido, no genera pago, no asigna repartidor y no participa en ventas. El vencimiento predeterminado es 30 días.
