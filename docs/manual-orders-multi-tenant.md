# Aislamiento multi-tenant

El `businessId` del body se considera una solicitud, no una autorización. El servicio valida `owner_id` para comercio y la función SQL repite la comprobación. Sucursal, producto y variante deben pertenecer al mismo negocio.

No existe combinación multi-comercio en un pedido.
