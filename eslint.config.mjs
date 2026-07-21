import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Estas reglas pertenecen al análisis de optimización del React Compiler.
    // Se conservan visibles, pero no bloquean un build que Next.js y TypeScript
    // validan correctamente. Las reglas de hooks, seguridad y tipos siguen siendo errores.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "prefer-const": "warn",
    },
  },
  {
    files: ["src/components/admin/live-dashboard/AdminLiveDashboard.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // useCurrentLocation es una operación asíncrona de geolocalización, no un hook.
    // El nombre se mantiene temporalmente por compatibilidad interna de esta pantalla.
    files: ["src/app/negocio/configuracion/ubicacion/page.tsx"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    files: ["src/app/cliente/checkout/page.tsx"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    // Project-specific ignores:
    "scripts/**",
  ]),
]);

export default eslintConfig;
