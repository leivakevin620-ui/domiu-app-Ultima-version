# DomiU Magdalena — interfaz premium y domicilios manuales

## Objetivo

Esta iteración mejora la legibilidad general de la aplicación y habilita un flujo compartido para registrar domicilios recibidos por WhatsApp, llamada, redes sociales o atención directa.

## Decisiones de diseño

- El tema predeterminado pasa a una base clara y neutra para mejorar la lectura.
- El amarillo DomiU se utiliza como acento y llamada a la acción, no como fondo dominante.
- El negro se reserva para navegación, resúmenes y superficies de alto contraste.
- Formularios, tarjetas, estados y textos utilizan variables semánticas de color.
- El tema oscuro permanece disponible mediante la clase `dark`.

## Identidad de marca

- El activo oficial continúa siendo la única fuente del logotipo.
- `DomiULogo` ya no introduce un lienzo SVG que pueda recortar o deformar la imagen.
- `DomiUMark` conserva siempre su relación de aspecto.
- `DomiUBrandLockup` combina el isotipo oficial con texto tipográfico para barras laterales estrechas, evitando reducir el logotipo cuadrado hasta hacerlo ilegible.

## Domicilios manuales

### Rutas

- Administración: `/admin/pedidos/crear`
- Negocio: `/negocio/pedidos/crear`

### Flujo

1. Pegar opcionalmente el mensaje recibido por WhatsApp.
2. Extraer y confirmar datos del cliente.
3. Seleccionar el negocio de recogida.
4. Validar la dirección de entrega.
5. Calcular distancia, tiempo y tarifa.
6. Definir método de pago.
7. Publicar para repartidores o asignar desde administración.
8. Crear el domicilio en el flujo normal de pedidos.

### Autorización

- Administración puede operar con todos los negocios activos.
- El negocio solo puede crear domicilios para establecimientos asociados a su propietario.
- La asignación manual de repartidor queda reservada a administración.
- Desde el panel de negocio el domicilio se publica para la operación disponible.

## Archivos principales

- `src/app/brand-vivid.css`
- `src/components/brand/DomiULogo.tsx`
- `src/components/admin/admin-sidebar.tsx`
- `src/components/business/business-sidebar.tsx`
- `src/app/actions/manual-deliveries.ts`
- `src/components/manual-orders/ManualDeliveryForm.tsx`
- `src/app/admin/pedidos/crear/page.tsx`
- `src/app/negocio/pedidos/crear/page.tsx`

## Validación requerida

Antes de producción se debe verificar:

- inicio de sesión de un administrador;
- inicio de sesión de un negocio;
- visibilidad correcta de negocios por propietario;
- extracción de un mensaje de WhatsApp;
- cálculo automático y manual de tarifa;
- creación pública y asignación administrativa;
- aparición del pedido en los paneles;
- visualización móvil y de escritorio;
- contraste de textos y estados;
- logo sin deformación en barras laterales y encabezados.
