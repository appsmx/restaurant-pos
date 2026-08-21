# 🍽️ Restaurant POS

Sistema de Punto de Venta para Restaurantes — construido con React, Express, PostgreSQL y Prisma.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.18-green)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.10-2D3748)](https://www.prisma.io/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com/)

---

## 📋 Descripción

Sistema POS diseñado específicamente para restaurantes con flujo completo:

**Mesa → Menú → Cocina → Cobro → Mesa libre**

### Características principales

- 🏗️ **Floor Plan** — Visualización de mesas por sección con estados en tiempo real
- 📋 **Menú** — Navegación por categorías con carrito flotante
- 🧾 **Órdenes** — Crear, enviar a cocina, cobrar con registro de pago
- 🔐 **Autenticación** — JWT con sesiones, roles (Admin, Manager, Waiter, Cashier, Chef)
- 🛡️ **Control de acceso** — Middleware de roles para operaciones privilegiadas
- ✅ **Validación** — Schemas Zod en todos los endpoints
- 💳 **Pagos** — Registro de método (efectivo, tarjeta, transferencia), monto y usuario

---

## 🏗️ Arquitectura

Monorepo con **pnpm workspaces** + **Turborepo**:

```
restaurant-pos/
├── apps/
│   └── web/                 ← Frontend (React + Vite + Tailwind)
│       └── src/
│           ├── components/  (POSLayout, Sidebar)
│           ├── pages/       (Login, FloorPlan, MenuBrowser, OrderPanel)
│           ├── stores/      (authStore, orderStore — Zustand)
│           ├── lib/         (apiClient)
│           └── styles/      (globals.css)
│
├── packages/
│   ├── api/                 ← Backend (Express + Prisma + PostgreSQL)
│   │   ├── prisma/          (schema, seed, migrations)
│   │   └── src/
│   │       ├── routes/      (auth, menu, floorPlan, orders)
│   │       ├── services/    (authService, menuService, floorPlanService, orderService)
│   │       ├── middleware/  (auth, requireRole, errorHandler, validate)
│   │       └── lib/         (prisma, errors, validators)
│   │
│   └── shared/              ← Tipos y utilidades compartidas
│       └── src/
│           ├── types/       (enums, interfaces)
│           └── utils/       (formatCurrency, roundToDecimal, calculateChange)
│
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## 🛠️ Tech Stack

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18, Vite 5, Tailwind CSS 3, Zustand 4 |
| **Backend** | Express 4, TypeScript 5, Zod 3 |
| **Base de datos** | PostgreSQL + Prisma 5 |
| **Autenticación** | JWT (jsonwebtoken) + bcrypt |
| **Monorepo** | pnpm workspaces + Turborepo |

---

## 🚀 Instalación

### Prerrequisitos

- Node.js 18+
- pnpm 9+
- PostgreSQL 14+

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/appsmx/restaurant-pos.git
cd restaurant-pos

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp packages/api/.env.example packages/api/.env
# Edita packages/api/.env con tu DATABASE_URL y JWT_SECRET

# 4. Crear la base de datos y ejecutar migraciones
cd packages/api
pnpm migrate

# 5. Ejecutar el seed (usuario admin + datos de prueba)
pnpm seed

# 6. Volver a la raíz
cd ../..
```

---

## ▶️ Ejecución

Necesitas **2 terminales**:

```bash
# Terminal 1 — Backend (http://localhost:3001)
pnpm -F @pos/api dev

# Terminal 2 — Frontend (http://localhost:5173)
pnpm -F @pos/web dev
```

O con Turborepo (ambos a la vez):

```bash
pnpm dev
```

---

## 🔑 Credenciales de prueba

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| `admin` | `Admin1234` | ADMIN |

---

## 📡 API Endpoints

Base URL: `http://localhost:3001/api`

### Auth
| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/auth/login` | Login (devuelve JWT) | ❌ |
| POST | `/auth/logout` | Logout (invalida sesión) | ✅ |

### Menú
| Método | Ruta | Descripción | Auth | Rol |
|--------|------|-------------|------|-----|
| GET | `/menu/categories` | Listar categorías con productos | ✅ | Cualquiera |
| GET | `/menu/products?categoryId=` | Listar productos | ✅ | Cualquiera |
| POST | `/menu/products` | Crear producto | ✅ | ADMIN, MANAGER |

### Floor Plan
| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/floorplan/sections` | Listar secciones con mesas | ✅ |
| GET | `/floorplan/tables?sectionId=` | Listar mesas | ✅ |
| PATCH | `/floorplan/tables/:id/status` | Cambiar estado de mesa | ✅ |

### Órdenes
| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/orders` | Crear orden (ocupa mesa) | ✅ |
| POST | `/orders/:id/items` | Agregar item a orden | ✅ |
| PATCH | `/orders/:id/send` | Enviar a cocina | ✅ |
| GET | `/orders/active` | Listar órdenes activas | ✅ |
| PATCH | `/orders/:id/pay` | Cobrar orden (libera mesa) | ✅ |

---

## 🔄 Flujo principal

```
1. Login
2. Click mesa DISPONIBLE (verde) → abre menú
3. Seleccionar productos → se agregan al carrito
4. "Enviar a Cocina" → crea orden + asigna mesa + envía items
5. Mesa cambia a OCUPADA (rojo)
6. En panel de Órdenes → "Cobrar" → registra pago + libera mesa
7. Mesa vuelve a DISPONIBLE (verde)
```

---

## 📊 Estados

### Mesa
`AVAILABLE` → `OCCUPIED` → `RESERVED` → `DIRTY` → `OUT_OF_SERVICE`

### Orden
`OPEN` → `SENT` → `PREPARING` → `READY` → `DELIVERED` → `CLOSED` / `CANCELLED`

### Pago
`PENDING` → `COMPLETED` / `CANCELLED`

---

## 🗺️ Roadmap

- [ ] 📦 **Módulo de Inventario** — Stock de ingredientes, descontar al vender
- [ ] 📊 **Historial y Reportes** — Órdenes cerradas, estadísticas, cierres de caja
- [ ] 📱 **Responsive / PWA** — Adaptación móvil, instalable
- [ ] 🚀 **Deploy** — Neon (DB) + Render (API) + Vercel (Web)
- [ ] 🖨️ **Impresión de tickets** — Cocina y cliente
- [ ] 🔔 **Notificaciones en tiempo real** — WebSockets para cocina

---

## 📄 Licencia

Privado — © appsmx
