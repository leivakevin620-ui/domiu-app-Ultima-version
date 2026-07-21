# Roles y permisos — pedidos manuales

| Capacidad | Comercio | Administrador |
|---|---:|---:|
| Crear para negocio propio | Sí | Sí |
| Crear para otro negocio | No | Sí |
| Buscar clientes | Solo clientes previos del negocio | Plataforma |
| Cliente invitado | Sí | Sí |
| Producto personalizado | Según configuración | Sí |
| Sobrescribir tarifa | Según configuración | Sí |
| Aplicar descuento/recargo | No | Sí, con motivo |
| Ignorar cierre o restricción | No | Sí, con motivo |
| Asignar repartidor | No | Sí |
| Estado inicial | Pendiente/confirmado | Pendiente/confirmado/asignado al elegir repartidor |
| Ver borradores | Solo propios | Solo propios mediante API; RLS permite administración |

La autorización efectiva se ejecuta en backend y PostgreSQL. Ocultar controles en la interfaz no reemplaza una comprobación de permisos.
