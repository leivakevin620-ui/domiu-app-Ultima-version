# Despliegue DomiU — 18 de julio de 2026

Esta rama despliega la interfaz y los servicios de pruebas para:

- cálculo financiero 80 % repartidor / 20 % DomiU;
- tarifa de servicio del 3 % con mínimo de 500 COP y máximo de 2.500 COP;
- comercio con 0 % de comisión sobre productos;
- apertura y cierre de jornadas;
- liquidaciones y saldos;
- dashboards de administrador, comercio y repartidor;
- mapa operativo en vivo;
- reportes administrativos;
- asistente Domi por perfil;
- botón para marcar notificaciones como leídas;
- catálogos de referencia con avisos de validación.

El esquema financiero y operativo ya fue aplicado al proyecto Supabase `DomiU App 1.0`. Los archivos de migración repetidos se excluyeron de esta rama para evitar ejecutar nuevamente tablas, funciones, triggers o saldos existentes.

Configuración activa de pruebas:

- moneda: COP;
- comisión del comercio sobre productos: 0 %;
- ganancia del repartidor: 80 % exacto del domicilio;
- comisión DomiU sobre domicilio: 20 % exacto;
- tarifa de servicio: 3 % del subtotal;
- tarifa mínima: 500 COP;
- tarifa máxima: 2.500 COP.
