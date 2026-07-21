# Revisión de seguridad

## Amenazas consideradas

- Suplantación de actor o creador.
- Cambio de tenant, negocio o sucursal.
- Manipulación de precio, descuento, tarifa o total.
- Sobreventa por concurrencia.
- Doble creación por reintento.
- Acceso de cliente por coincidencia de teléfono.
- Exposición de notas internas.
- CSRF y llamadas cross-site.
- Inyección en búsquedas y notas.
- Exposición de claves privadas.

## Controles

- Sesión validada server-side.
- Zod estricto y límites de longitud.
- Consultas Supabase con filtros y valores escapados.
- `SECURITY DEFINER` sin permisos públicos y `search_path` fijo.
- Tenant y actor revalidados dentro de PostgreSQL.
- Precios leídos del catálogo.
- `FOR UPDATE` y decremento condicionado.
- Idempotencia única y hash del cuerpo.
- Same-origin y `Sec-Fetch-Site`.
- Rate limiting por actor.
- RLS en borradores y movimientos.
- Logs sin secretos ni datos de tarjeta.
