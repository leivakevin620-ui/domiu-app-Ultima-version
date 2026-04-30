# DomiU Magdalena - Gestión de Domicilios

App profesional para gestión de domicilios con Next.js + Supabase.

## Configuración inicial

### 1. Crear proyecto en Supabase

1. Ve a https://supabase.com y crea una cuenta
2. Click en "New Project"
3. Nombre: `domiu-magdalena`, contraseña segura
4. Espera a que se cree

### 2. Configurar base de datos

1. En Supabase, ve a **SQL Editor**
2. Copia el contenido de `supabase/setup.sql`
3. Pega y ejecuta

### 3. Configurar variables de entorno

1. Copia `.env.local.example` a `.env.local`
2. Ve a **Project Settings → API** en Supabase
3. Copia **Project URL** y **anon/public key**
4. Pégalos en `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon
```

### 4. Instalar dependencias

```bash
npm install
```

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

Abre http://localhost:3000

## Deploy en Vercel

1. Push a GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/tu-usuario/domiu-magdalena.git
git push -u origin main
```

2. Ve a https://vercel.com
3. Importa tu repositorio
4. Agrega las variables de entorno en Vercel
5. Deploy automático
