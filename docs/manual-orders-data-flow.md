# Flujo de datos

Navegador → API: identificadores y datos capturados, sin actor o total confiable.

API → servicio: payload Zod y actor autenticado.

Servicio → Supabase: catálogo, stock, configuración y permisos.

Servicio → RPC: payload normalizado e idempotencia.

RPC → tablas/triggers: pedido, artículos, movimientos, seguimiento, auditoría, finanzas y notificaciones.

Respuesta → navegador: identificador, número, estado y total final.
