# DomiU App

Plataforma de delivery multi-rol para cliente, negocio, repartidor y administracion.

## Stack

- Next.js 16.2.9 con App Router y `src/proxy.ts`
- React 19.2.4
- TypeScript strict
- Supabase Auth, Database, Storage y Realtime
- Tailwind CSS 4
- Zod 4
- Recharts
- Framer Motion

## Comandos

```bash
npm install
npm run check:env
npm run lint
npm run build
npm run dev
```

## Estado actual

Este repositorio esta en fase **DomiU App 1.2 - Release Candidate**.

Validaciones locales actuales:

- `npm run lint`: 0 errors, 0 warnings
- `npm run build`: OK (59 rutas, 0 TS errors)
- `npm run test`: OK (27 tests, 4 suites)
- `npm run check:env`: checks criticos OK con warnings de infraestructura

## Modulo de Pagos Enterprise

Arquitectura desacoplada en `src/lib/payments/` con 8 providers stub.
No conectado al checkout existente. Ver [PROJECT_STATUS.md](./PROJECT_STATUS.md) para detalle.

Ver detalles en [PROJECT_STATUS.md](./PROJECT_STATUS.md).

## Arquitectura

```text
src/
├── app/          Next.js App Router
├── components/   Componentes UI reutilizables
├── contexts/     Contextos React
├── services/     Servicios de dominio
├── lib/          Supabase, pagos, mapas, storage, utilidades
├── types/        Tipos TypeScript y DB
└── hooks/        Hooks custom
```

## Notas RC

- No agregar funcionalidades nuevas durante esta fase.
- No implementar nuevos modulos de pagos, IA, SaaS o Realtime.
- Antes de produccion se debe cerrar la brecha de Storage remoto y ejecutar auditoria Lighthouse final.
