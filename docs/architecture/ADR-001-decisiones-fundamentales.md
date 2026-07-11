# ADR-001 — Decisiones fundamentales de arquitectura de DomiU Magdalena

**Estado:** Aprobado  
**Fecha:** 2026-07-10  
**Proyecto:** DomiU Magdalena  
**Alcance:** Producto, pedidos, logística, finanzas, zonas y escalabilidad

## 1. Propósito

Este documento establece decisiones obligatorias para la evolución de DomiU Magdalena. Toda implementación futura debe respetarlas o proponer una nueva ADR que explique y apruebe el cambio.

## 2. Pedido y carrito

### Decisión

Un pedido pertenece a un único negocio.

### Reglas

- Un carrito solo puede contener productos de un negocio.
- Al agregar un producto de otro negocio, el cliente debe confirmar si desea vaciar el carrito actual.
- Productos, precios, opciones, descuentos e impuestos deben guardarse como snapshot en el pedido.
- El soporte multi-negocio podrá estudiarse en una fase futura, pero no forma parte del núcleo inicial.

## 3. Multi-tenant desde la arquitectura

### Decisión

DomiU se diseñará desde ahora con capacidad multi-tenant, aunque inicialmente opere una sola marca y una sola organización.

### Modelo conceptual

- `tenants`: organización o marca operadora.
- `cities`: ciudades habilitadas por tenant.
- `zones`: polígonos operativos dentro de una ciudad.
- `businesses`: negocios afiliados a un tenant.
- `profiles`: usuarios globales.
- `tenant_memberships`: relación entre usuarios, tenants, roles y permisos.

### Reglas

- Toda entidad operativa nueva debe evaluar si requiere `tenant_id`.
- Las consultas administrativas deben estar limitadas al tenant correspondiente.
- Las políticas RLS no deben depender únicamente de filtros del frontend.
- La identidad visual, comisiones, zonas, categorías y configuración deben poder definirse por tenant.
- No se permitirá que un administrador delegado consulte información de otro tenant.

## 4. Asignación automática de repartidores

### Decisión

La asignación utilizará un motor de puntuación configurable y una reserva transaccional.

### Elegibilidad mínima

El repartidor debe estar:

- verificado;
- activo;
- disponible;
- conectado recientemente;
- dentro de la zona o radio permitido;
- sin suspensión;
- sin una carga de pedidos incompatible.

### Criterios iniciales del scoring

- Distancia al negocio: 40 %.
- Tiempo sin asignación: 20 %.
- Carga activa: 15 %.
- Calificación: 10 %.
- Tasa de aceptación: 10 %.
- Desempeño y cancelaciones: 5 %.

Los pesos serán configurables y deberán sumar 100 %.

### Concurrencia

- Una asignación debe reservarse mediante operación atómica.
- Dos repartidores no pueden aceptar el mismo pedido.
- La solicitud expira después de un tiempo configurable.
- Rechazo, expiración o desconexión deben activar una nueva ronda.

## 5. Cálculo del domicilio

### Decisión

Se utilizará un modelo híbrido configurable.

### Fórmula conceptual

`tarifa = base + distancia + zona + horario + demanda + recargos - subsidios`

### Componentes

- Tarifa base por tenant, ciudad o zona.
- Kilómetros incluidos.
- Valor por kilómetro adicional.
- Mínimo y máximo de tarifa.
- Recargo nocturno.
- Recargo por alta demanda.
- Envío gratis o subsidiado por promoción.
- Redondeo monetario definido por configuración.

El cálculo confirmado debe almacenarse como snapshot dentro del pedido.

## 6. Wallets y libro contable

### Decisión

Los saldos no serán editables directamente. Toda variación debe surgir de movimientos contables inmutables.

### Wallets iniciales

- Wallet del negocio.
- Wallet del repartidor.
- Wallet de la plataforma.

### Reglas

- Cada movimiento debe tener tipo, monto, moneda, referencia, actor y fecha.
- Los ajustes manuales requieren permiso crítico, motivo y auditoría.
- Las transacciones deben ser idempotentes.
- Los movimientos relacionados con un pedido deben conservar `order_id`.
- Las liquidaciones y retiros deben tener su propio ciclo de estados.
- El saldo disponible y el saldo pendiente deben diferenciarse.

## 7. Comisiones

### Decisión

Las comisiones serán configurables por tenant, categoría, negocio, ciudad y periodo de vigencia.

### Tipos

- Porcentaje.
- Valor fijo.
- Esquema mixto.
- Promoción temporal.

La regla específica del negocio tendrá prioridad sobre la regla de categoría y la regla general del tenant.

## 8. Pagos

### Decisión

Todas las formas de pago se integrarán mediante una capa `PaymentService` y proveedores desacoplados.

### Métodos previstos

- Efectivo.
- Transferencia manual.
- Nequi y Daviplata mediante integración autorizada cuando corresponda.
- PSE.
- Tarjeta.
- Wallet interna futura.

### Reglas

- Los webhooks deben verificarse criptográficamente.
- Las operaciones deben ser idempotentes.
- DomiU no almacenará datos completos de tarjetas.
- El estado del pago y el estado del pedido son dominios relacionados, pero distintos.

## 9. Zonas y cobertura

### Decisión

La cobertura se modelará mediante ciudades y polígonos geográficos con PostGIS.

Cada zona podrá definir:

- cobertura;
- tarifa base;
- tiempo estimado;
- límites de distancia;
- horarios;
- repartidores elegibles;
- reglas de demanda;
- disponibilidad de categorías.

## 10. Horarios

Los negocios deben soportar:

- horario semanal;
- cierres temporales;
- festivos;
- vacaciones;
- pausas operativas;
- disponibilidad por producto.

El servidor debe impedir pedidos fuera del horario permitido.

## 11. Inventario

Los productos podrán operar con:

- stock no controlado;
- stock manual;
- disponibilidad temporal;
- agotado;
- oculto;
- pausado.

La reserva de inventario deberá definirse antes de conectar pagos reales.

## 12. Promociones

Tipos iniciales:

- porcentaje;
- valor fijo;
- envío gratis;
- 2x1;
- combo;
- horario especial;
- primera compra;
- cupón.

Toda promoción debe tener vigencia, elegibilidad, límites de uso y responsable del subsidio.

## 13. Calificaciones

Se podrán registrar calificaciones entre actores, pero nunca se publicarán datos sensibles.

La reputación usada en asignaciones debe resistir manipulación y considerar un mínimo de muestras.

## 14. Notificaciones

Canales previstos:

- internas;
- push web;
- correo;
- WhatsApp o SMS futuros.

Cada notificación debe registrar evento, destinatario, canal, estado de entrega y reintentos.

## 15. Auditoría

Toda acción crítica debe registrar:

- tenant;
- usuario o servicio;
- acción;
- entidad;
- resultado;
- fecha;
- IP y dispositivo cuando estén disponibles;
- motivo;
- valores anteriores y posteriores cuando sea seguro almacenarlos.

## 16. Estrategia de implementación

La adopción se realizará por fases para no comprometer la versión Release Candidate actual:

1. Documentación y ADR.
2. Auditoría del esquema actual.
3. Diseño de migraciones compatibles.
4. Introducción de tenant predeterminado.
5. Propagación gradual de `tenant_id`.
6. RLS multi-tenant.
7. Servicios de dominio.
8. Panel de configuración.
9. Pruebas de aislamiento.
10. Activación funcional.

## 17. Criterios de aceptación

- Ningún cambio rompe el flujo actual de pedidos.
- Las migraciones son reversibles o incluyen un plan de recuperación.
- El tenant inicial se asigna a los registros existentes.
- Las políticas RLS impiden acceso cruzado.
- El carrito rechaza productos de otro negocio.
- La asignación evita concurrencia doble.
- Los saldos derivan únicamente del ledger.
- Toda acción crítica genera auditoría.
