# Objetivos operativos

Objetivos iniciales:

- cotización p95 menor a 2 segundos;
- confirmación p95 menor a 4 segundos sin proveedores externos;
- disponibilidad mensual de APIs de 99,9 %;
- tasa de 5xx menor a 1 %;
- cero pedidos duplicados con la misma clave;
- cero inventarios negativos;
- cero acceso cross-tenant confirmado.

Las alertas deben separar errores de validación 4xx de fallos internos 5xx.
