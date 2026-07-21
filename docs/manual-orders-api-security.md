# Seguridad HTTP

Las escrituras usan `POST` o `DELETE`, validan same-origin y no aceptan CORS público. Las respuestas no se almacenan. La sesión se obtiene del servidor y el actor no se acepta en el cuerpo.

Los endpoints tienen límites por minuto y Zod `.strict()`. Los UUID se validan; textos tienen límites y las búsquedas eliminan metacaracteres de filtros.
