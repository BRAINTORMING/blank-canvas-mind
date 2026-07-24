# GdudeX — Paleta de colores maestra

Fuente de verdad: `src/index.css` (`:root`) + `tailwind.config.ts`.
Todos los valores son HSL (`H S% L%`) para consumirse con `hsl(var(--token))`.
Este archivo documenta el mapa completo para preparar el **modo oscuro**.

## 1. Tokens semánticos (light — actual)

| Token                       | HSL             | Uso                                      |
| --------------------------- | --------------- | ---------------------------------------- |
| `--background`              | `0 0% 100%`     | Fondo global de la app                   |
| `--foreground`              | `0 0% 9%`       | Texto principal                          |
| `--card` / `--popover`      | `0 0% 100%`     | Superficies elevadas                     |
| `--card-foreground`         | `0 0% 9%`       | Texto sobre superficies                  |
| `--primary`                 | `204 93% 61%`   | Accent (#40AEF8) — botones, links, focus |
| `--primary-foreground`      | `0 0% 100%`     | Texto sobre primary                      |
| `--secondary` / `--muted`   | `0 0% 96%`      | Superficies sutiles / chips              |
| `--secondary-foreground`    | `0 0% 9%`       | Texto sobre secondary                    |
| `--muted-foreground`        | `0 0% 40%`      | Texto secundario                         |
| `--accent`                  | `204 93% 61%`   | = primary                                |
| `--destructive`             | `0 72% 51%`     | Errores / eliminar                       |
| `--destructive-foreground`  | `0 0% 100%`     | Texto sobre destructive                  |
| `--border` / `--input`      | `0 0% 91%`      | Bordes                                   |
| `--ring`                    | `204 93% 61%`   | Focus ring                               |
| `--radius`                  | `0.625rem`      | Radio base                               |

### Sidebar

| Token                              | HSL             |
| ---------------------------------- | --------------- |
| `--sidebar-background`             | `0 0% 100%`     |
| `--sidebar-foreground`             | `0 0% 9%`       |
| `--sidebar-primary`                | `204 93% 61%`   |
| `--sidebar-primary-foreground`     | `0 0% 100%`     |
| `--sidebar-accent`                 | `0 0% 96%`      |
| `--sidebar-accent-foreground`      | `0 0% 9%`       |
| `--sidebar-border`                 | `0 0% 91%`      |
| `--sidebar-ring`                   | `204 93% 61%`   |

## 2. Estados de proyecto

| Token                     | HSL             | Significado         |
| ------------------------- | --------------- | ------------------- |
| `--status-approved`       | `145 63% 42%`   | Aprobado            |
| `--status-rejected`       | `0 72% 51%`     | Rechazado           |
| `--status-in-review`      | `38 92% 50%`    | En revisión         |
| `--status-not-qualified`  | `0 0% 60%`      | No calificado       |
| `--status-abandoned`      | `0 0% 70%`      | Abandonado          |

## 3. Colores por sector (capas del mapa)

| Token               | HSL             | Sector           |
| ------------------- | --------------- | ---------------- |
| `--mining`          | `25 75% 47%`    | Minería          |
| `--port`            | `210 80% 45%`   | Puertos          |
| `--energy`          | `38 92% 50%`    | Energía          |
| `--infrastructure`  | `0 0% 45%`      | Infraestructura  |
| `--protected`       | `145 63% 42%`   | Áreas protegidas |

## 4. Sombras y transiciones

- `--shadow-1`: `0 1px 2px 0 hsl(0 0% 0% / 0.04)`
- `--shadow-2`: `0 2px 8px -2px hsl(0 0% 0% / 0.06), 0 1px 3px hsl(0 0% 0% / 0.04)`
- `--shadow-3`: `0 8px 24px -8px hsl(0 0% 0% / 0.10), 0 2px 6px hsl(0 0% 0% / 0.04)`
- `--transition-fast`: `all 120ms ease-out`
- `--transition-smooth`: `all 180ms cubic-bezier(0.4, 0, 0.2, 1)`
- `--transition-bounce`: `all 220ms cubic-bezier(0.34, 1.3, 0.64, 1)`

## 5. Paletas específicas de monitoreo territorial

Definidas en `src/lib/monitoring/palettes.ts` como stops de gradiente (hex).
No son tokens CSS — son escalas de datos y **no deben cambiar en dark mode**.

- Temperatura: `#0b1e5b → #2b6cb0 → #4dc4ff → #7ee787 → #facc15 → #f97316 → #dc2626`
- Radiación solar: `#1e3a8a → #22c55e → #facc15 → #f97316 → #b91c1c`
- UV: `#22c55e → #facc15 → #f97316 → #dc2626 → #7e22ce`
- Humedad: `#fef3c7 → #fde68a → #67e8f9 → #3b82f6 → #1e3a8a`
- Precipitación: `#eef2ff → #93c5fd → #3b82f6 → #4338ca → #312e81`
- Nubosidad: `#f8fafc → #cbd5e1 → #64748b → #1e293b`
- Presión: `#7c3aed → #3b82f6 → #22c55e → #f97316 → #dc2626`
- Riesgo de incendio: `#22c55e → #facc15 → #f97316 → #dc2626 → #7e22ce`

## 6. Legacy Tailwind aliases (mapeados al sistema light)

Definidos en `tailwind.config.ts` para no romper referencias antiguas:

- `cool-white` → `hsl(0 0% 9%)`
- `navy-deep` / `navy-mid` → `hsl(0 0% 100%)`
- `navy-light` → `hsl(0 0% 96%)`
- `cyan-electric` → `hsl(204 93% 61%)`
- `emerald-vibrant` → `hsl(145 63% 42%)`
- `amber-intel` → `hsl(38 92% 50%)`
- `magenta-signal` → `hsl(0 72% 51%)`
- `gray-blue` → `hsl(0 0% 45%)`

## 7. Propuesta de tokens para **modo oscuro** (futuro)

Reemplazar el bloque `.dark { ... }` en `src/index.css` con:

```css
.dark {
  --background: 222 20% 8%;        /* casi negro azulado */
  --foreground: 0 0% 96%;

  --card: 222 20% 11%;
  --card-foreground: 0 0% 96%;
  --popover: 222 20% 11%;
  --popover-foreground: 0 0% 96%;

  --primary: 204 93% 61%;          /* accent constante */
  --primary-foreground: 222 20% 8%;

  --secondary: 222 15% 16%;
  --secondary-foreground: 0 0% 96%;
  --muted: 222 15% 16%;
  --muted-foreground: 0 0% 65%;
  --accent: 204 93% 61%;
  --accent-foreground: 222 20% 8%;

  --destructive: 0 72% 55%;
  --destructive-foreground: 0 0% 100%;

  --border: 222 15% 20%;
  --input: 222 15% 20%;
  --ring: 204 93% 61%;

  --sidebar-background: 222 20% 10%;
  --sidebar-foreground: 0 0% 96%;
  --sidebar-primary: 204 93% 61%;
  --sidebar-primary-foreground: 222 20% 8%;
  --sidebar-accent: 222 15% 16%;
  --sidebar-accent-foreground: 0 0% 96%;
  --sidebar-border: 222 15% 20%;
  --sidebar-ring: 204 93% 61%;
}
```

Los tokens de estado (`--status-*`), sector (`--mining`, etc.) y las paletas de
monitoreo se mantienen iguales porque tienen significado semántico independiente
del tema.

## 8. Reglas de uso

1. **Nunca** usar clases como `text-white`, `bg-black`, `bg-[#hex]` en componentes.
2. Referenciar siempre tokens: `bg-background`, `text-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, etc.
3. Para superficies con opacidad usar `hsl(var(--primary) / 0.12)`.
4. Al agregar un color nuevo: definirlo en `:root` de `src/index.css` **y** exponerlo en `tailwind.config.ts`.
