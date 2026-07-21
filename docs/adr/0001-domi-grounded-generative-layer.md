# ADR-0001: capa generativa fundamentada y opcional

- Estado: aceptado
- Fecha: 2026-07-21

## Contexto

Domi necesita lenguaje natural sin permitir que un modelo externo controle permisos, consulte directamente la base de datos o invente hechos operativos. El núcleo determinista y las herramientas ya resuelven autenticación, intención, datos, acciones y auditoría.

## Decisión

La generación externa se utiliza únicamente como capa de redacción sobre:

- solicitud sanitizada del usuario;
- respuesta determinista verificada;
- conocimiento aprobado para el rol;
- contexto de interfaz no sensible.

La integración usa Responses API con `store: false`, modelo configurable, razonamiento mínimo, máximo 350 tokens de salida, deadline total de siete segundos y dos intentos solo para errores transitorios.

El modelo no recibe herramientas, SQL, claves, cookies, correos, IDs de pedidos ni datos de otros tenants. La salida se rechaza cuando contiene secretos, enlaces externos, instrucciones internas o afirmaciones monetarias/temporales no respaldadas.

## Consecuencias

- Domi continúa operativo sin OpenAI.
- La autorización no depende del comportamiento del modelo.
- Se reduce costo mediante salida breve, razonamiento mínimo y prompt caching.
- Una respuesta insegura o no fundamentada activa automáticamente el fallback determinista.
- La observabilidad conserva proveedor, modelo, latencia e indicadores de uso, sin almacenar prompts en logs.

## Alternativas rechazadas

- Permitir tool calling directo desde el modelo: aumenta riesgo de escalamiento de privilegios.
- Enviar el historial completo: incrementa costo y exposición de datos.
- Hacer que el proveedor sea obligatorio: degrada disponibilidad del producto.
