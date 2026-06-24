# DomiU App — Sistema de Diseño Visual

## Tipografía Oficial

**Inter** — Moderna, limpia, profesional, fácil de leer, ideal para dashboards y apps móviles.

| Elemento | Peso | Clase Recomendada |
|---|---|---|
| Títulos grandes | Bold (700) | `font-bold` |
| Subtítulos | Semibold (600) | `font-semibold` |
| Texto normal | Normal (400) | `font-normal` |
| Texto secundario | Medium (500) | `font-medium` |
| Botones | Semibold (600) | `font-semibold` |
| Labels formularios | Semibold (600) | `font-semibold uppercase tracking-wide` |

La fuente ya está configurada en `globals.css` mediante `--font-inter` y activada con `font-sans`.

---

## Paleta de Colores

### Colores Base (CSS Custom Properties)

| Token | Uso | Hex (aprox.) |
|---|---|---|
| `--background` | Fondo principal oscuro | `#0F172A` |
| `--foreground` | Texto principal | `#FFFFFF` |
| `--card` | Fondo de tarjetas | `#1E293B` |
| `--card-foreground` | Texto sobre tarjetas | `#FFFFFF` |
| `--muted` | Fondo secundario / hover | `~#1E293B` |
| `--muted-foreground` | Texto secundario | `#94A3B8` |
| `--border` | Bordes | `#334155` |
| `--input` | Bordes de inputs | `#334155` |
| `--input-bg` | Fondo de inputs | `#253244` |
| `--ring` | Focus ring | `#3B82F6` |

### Colores Semánticos

| Token | Uso | Hex |
|---|---|---|
| `--primary` | Azul DomiU (acciones principales) | `#2563EB` / `#3B82F6` |
| `--primary-foreground` | Texto sobre primary | `#FFFFFF` |
| `--success` | Verde éxito / acción positiva | `#10B981` |
| `--warning` | Amarillo alerta / pendiente | `#F59E0B` |
| `--destructive` | Rojo error / peligro | `#EF4444` |
| `--info` | Azul informativo | `#3B82F6` |

### Colores de Marca (Tokens DomiU)

| Clase Tailwind | Hex |
|---|---|
| `bg-domiu-blue` / `text-domiu-blue` | `#2563EB` |
| `bg-domiu-blue-light` / `text-domiu-blue-light` | `#3B82F6` |
| `bg-domiu-dark` / `text-domiu-dark` | `#0F172A` |
| `bg-domiu-card` / `text-domiu-card` | `#1E293B` |
| `bg-domiu-input-bg` / `text-domiu-input-bg` | `#253244` |
| `bg-domiu-border` / `text-domiu-border` | `#334155` |
| `bg-domiu-text` / `text-domiu-text` | `#FFFFFF` |
| `bg-domiu-muted` / `text-domiu-muted` | `#94A3B8` |
| `bg-domiu-success` / `text-domiu-success` | `#10B981` |
| `bg-domiu-warning` / `text-domiu-warning` | `#F59E0B` |
| `bg-domiu-danger` / `text-domiu-danger` | `#EF4444` |
| `bg-domiu-light` / `text-domiu-light` | `#F8FAFC` |

### Combinación Principal

```
#0F172A + #2563EB + #10B981 + #FFFFFF
```

- Fondos oscuros premium
- Azul para acciones principales y marca
- Verde para acciones positivas y estados operativos
- Blanco para texto principal
- Gris azulado (`#94A3B8`) para textos secundarios

---

## Reglas de Diseño

### Fondos

| Contexto | Clase |
|---|---|
| Panel admin / repartidor / negocio | `bg-background` |
| Tarjetas | `bg-card` |
| Inputs | `bg-input-bg` |
| Bordes | `border-border` |

### Cards

```tsx
<div className="rounded-xl border border-border bg-card p-5 shadow-sm">
```

- Bordes redondeados (`rounded-xl` o `rounded-2xl`)
- Padding cómodo (`p-4`, `p-5`, `p-6`)
- Sombra suave (`shadow-sm`)
- Borde sutil (`border border-border`)
- Buen contraste (`bg-card`)
- Separación clara (`space-y-4`)

### Botones

| Tipo | Clases |
|---|---|
| Primario (azul) | `bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90` |
| Positivo (verde) | `bg-success text-white font-semibold rounded-xl hover:bg-success/90` |
| Peligro | `bg-destructive text-destructive-foreground font-semibold rounded-xl hover:bg-destructive/90` |
| Alerta | `bg-warning text-black font-semibold rounded-xl hover:bg-warning/90` |
| Outline | `border border-border text-foreground font-medium rounded-xl hover:bg-muted` |
| Ghost | `text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl` |
| Link | `text-primary hover:underline font-medium` |

### Badges de Estado

| Estado | Clases |
|---|---|
| Activo / Verificado | `bg-success/20 text-success` |
| Pendiente | `bg-warning/20 text-warning` |
| Suspendido / Error | `bg-destructive/20 text-destructive` |
| En camino / Tecnológico | `bg-info/20 text-info` |
| Inactivo | `bg-muted text-muted-foreground` |

### Formularios

- Labels en `text-sm font-semibold text-muted-foreground` o `text-xs font-semibold uppercase tracking-wide text-muted-foreground`
- Inputs con `bg-input-bg border border-input text-foreground rounded-lg px-3 py-2 h-10`
- Placeholders automáticos en color `text-muted-foreground`
- Estados disabled con `opacity-50 cursor-not-allowed`
- Loading con spinner `<Loader2 className="h-4 w-4 animate-spin" />`
- Errores con `text-destructive text-sm`

### Tablas

- Encabezados: `text-xs font-semibold uppercase tracking-wide text-muted-foreground`
- Filas con hover: `hover:bg-muted/50`
- Responsive: convertir a cards en mobile si la tabla no cabe

### Modales

- Overlay: `fixed inset-0 bg-black/60 backdrop-blur-sm`
- Contenedor: `bg-card border border-border rounded-xl shadow-modal p-6`
- Botones con separación clara

### Íconos

Usar `lucide-react` — tamaño consistente (`h-4 w-4`), color según acción.

---

## Responsive

Soportar: 320px, 360px, 390px, 414px, 768px, 1024px, 1440px, 1920px.

| Breakpoint | Comportamiento |
|---|---|
| Móvil (<768px) | 1 columna, botones grandes, inputs cómodos, sin overflow horizontal, cards limpias |
| Tablet (768-1024px) | Grids adaptables, sidebar colapsable |
| Desktop (>1024px) | Grids organizados, sidebar fijo, tablas completas, dashboards amplios |

Usar `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` o similar.

---

## Accesibilidad

- Contraste suficiente en todos los textos
- `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`
- `aria-label` en botones sin texto
- `alt` descriptivo en imágenes
- Navegación por teclado
- Estados de loading, error, empty visibles
- No usar texto gris demasiado claro sobre fondo oscuro

---

## Clases Recomendadas (Tailwind v4)

| Propósito | Clases |
|---|---|
| Título de página | `text-2xl font-bold text-foreground` |
| Subtítulo | `text-sm text-muted-foreground` |
| Card estándar | `rounded-xl border border-border bg-card p-5 shadow-sm` |
| Badge éxito | `inline-flex items-center gap-1 rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-success` |
| Badge alerta | `inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning` |
| Badge error | `inline-flex items-center gap-1 rounded-full bg-destructive/20 px-2 py-0.5 text-xs font-medium text-destructive` |
| Botón primario | `inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all` |
| Botón outline | `inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-all` |
| Input | `h-10 w-full rounded-lg border border-input bg-input-bg px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20` |
| Select (igual que input) | `h-10 w-full rounded-lg border border-input bg-input-bg px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20` |
| Label | `text-xs font-semibold uppercase tracking-wide text-muted-foreground` |
| Sección | `rounded-xl border border-border bg-card p-5 space-y-4` |
| Tab | `px-4 py-3 text-sm font-medium border-b-2 transition-all data-[active=true]:border-primary data-[active=true]:text-primary data-[active=false]:border-transparent data-[active=false]:text-muted-foreground hover:text-foreground` |
| Modal overlay | `fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm` |
| Modal content | `w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-modal` |
| Icon container | `flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20` |
| Empty state | `flex flex-col items-center justify-center py-16 text-muted-foreground` |
| Loading state | `flex items-center justify-center py-20 text-muted-foreground` |

---

## Estados de UI

Toda pantalla debe implementar:

1. **Loading** → indicador visual mientras se cargan datos
2. **Error** → mensaje descriptivo si falla la carga
3. **Empty** → mensaje y acción sugerida si no hay datos
4. **Success** → toast o feedback tras acción exitosa

---

## Regla Obligatoria para Futuras Pantallas

Toda nueva pantalla o componente de DomiU debe respetar esta identidad visual antes de considerarse terminado.

Cada vez que se cree un módulo nuevo, verificar:

1. ¿Usa los colores oficiales (theme tokens)?
2. ¿Usa la tipografía oficial (Inter / font-sans)?
3. ¿Respeta el estilo premium oscuro?
4. ¿Tiene responsive móvil?
5. ¿Tiene estados loading/error/empty?
6. ¿Tiene accesibilidad básica (focus, aria-label, contraste)?
7. ¿No usa colores aleatorios (slate/gray directos)?
8. ¿No rompe la identidad visual de DomiU?

Si algo no cumple, corregirlo antes de terminar.
