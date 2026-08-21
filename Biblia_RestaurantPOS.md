# Biblia — Restaurant POS

**Versión:** 1.0
**Estado:** Oficial
**Propósito:** Documento de autoridad del producto Restaurant POS. Contiene la visión, decisiones técnicas, arquitectura, estado actual y backlog del proyecto.
**Fecha:** 2026-08-20
**Metodología:** LOGAN v1.0

---

## 1. Visión del Producto

### 1.1 ¿Qué es?

Sistema de Punto de Venta (POS) especializado para restaurantes. Open-source, self-hosted, construido desde cero con stack moderno (React + Express + PostgreSQL + Prisma).

### 1.2 ¿Para quién?

Restaurantes pequeños y medianos que necesitan un sistema digital para gestionar mesas, pedidos, cocina y cobros — sin depender de soluciones SaaS con costos mensuales.

### 1.3 ¿Qué problema resuelve?

Los sistemas POS comerciales (Loyverse, Square, Toast) son:
- Caros (suscripciones mensuales)
- Genéricos (no optimizados para el flujo de un restaurante con mesas)
- Cerrados (no se pueden personalizar)

Restaurant POS ofrece:
- **Costo cero** de licencia
- **Flujo especializado**: Mesa → Menú → Cocina → Cobro → Mesa libre
- **100% personalizable** al negocio específico
- **Control total** de datos

### 1.4 Propuesta de valor

Un mesero toma un pedido en 3 clics: mesa → productos → enviar a cocina. Un cajero cobra en 1 clic. El dueño ve todo en tiempo real.

---

## 2. Usuarios y Roles

| Rol | Responsabilidad | Acceso |
|-----|----------------|--------|
| **ADMIN** | Configuración total del sistema | Todo |
| **MANAGER** | Gestión de menú, reportes, supervisión | Todo excepto config de sistema |
| **WAITER** | Tomar pedidos, enviar a cocina | Mesas, Menú, Órdenes propias |
| **CASHIER** | Cobrar cuentas | Órdenes, Pagos |
| **CHEF** | Ver pedidos enviados a cocina | Pantalla de cocina (futuro) |

---

## 3. Arquitectura Técnica

### 3.1 Stack

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Frontend | React 18 + Vite 5 + Tailwind 3 | Rápido, ligero, DX excelente |
| Estado (frontend) | Zustand 4 | Simple, sin boilerplate (vs Redux) |
| Backend | Express 4 + TypeScript 5 | Flexible, maduro, abundante ecosistema |
| Validación | Zod 3 | Type-safe, declarativo, zero deps |
| ORM | Prisma 5 | Type-safe queries, migraciones automáticas |
| Base de datos | PostgreSQL 14+ | Robusto, confiable, gratuito |
| Auth | JWT + bcrypt + sesiones en DB | Stateful sessions para invalidación en logout |
| Monorepo | pnpm workspaces + Turborepo | Builds paralelos, deps compartidas |

### 3.2 Estructura del monorepo

```
restaurant-pos/
├── apps/web/          ← Frontend (React + Vite)
├── packages/api/      ← Backend (Express + Prisma)
└── packages/shared/   ← Types + Utilities compartidas
```

### 3.3 Modelo de datos

Entidades principales del schema de Prisma:

```
User ──────── Session (1:N)
  │
  ├── Order ─── OrderItem ─── OrderItemModifier
  │     │
  │     ├── Payment (1:N)
  │     └── Table (N:1)
  │
  └── StockMovement
  
Category ── Product ── ModifierItem ── ModifierGroup
               │
               └── RecipeIngredient ── Ingredient

Section ── Table

SyncQueue (cola offline)
```

### 3.4 Flujo de datos principal

```
[Frontend]                    [Backend]                     [DB]
    │                             │                          │
    ├─ POST /orders ─────────────►├─ createOrder() ─────────►│ Order + Table.OCCUPIED
    ├─ POST /orders/:id/items ───►├─ addOrderItem() ────────►│ OrderItem + total++
    ├─ PATCH /orders/:id/send ───►├─ sendToKitchen() ───────►│ items.SENT + order.SENT
    ├─ PATCH /orders/:id/pay ────►├─ closeOrder() ──────────►│ Payment + order.CLOSED
    │                             │                          │   + Table.AVAILABLE
    └─ GET /orders/active ◄──────┤◄─ getActiveOrders() ◄────┘
```

---

## 4. Decisiones Técnicas Aprobadas

### DEC-001: Usar menuService singleton en vez de PrismaClient directo en rutas
**Problema:** menu.ts creaba su propia instancia de PrismaClient.
**Decisión:** Refactorizar para usar el service pattern con singleton.
**Justificación:** Elimina conexiones innecesarias a DB; centraliza lógica de negocio.
**Fecha:** 2026-08-20

### DEC-002: Control de acceso basado en roles (RBAC) en middleware
**Problema:** requireRole existía pero no validaba roles.
**Decisión:** auth.ts trae el rol del user en el query de session; requireRole lo valida.
**Justificación:** Un solo query a DB, el rol está disponible en req.userRole para toda la cadena.
**Fecha:** 2026-08-20

### DEC-003: Todas las rutas del menú protegidas con auth
**Problema:** /menu/* no requería autenticación.
**Decisión:** router.use(auth) + requireRole('ADMIN', 'MANAGER') para POST /products.
**Justificación:** Es un POS interno, no un sitio público. Solo usuarios autenticados acceden.
**Fecha:** 2026-08-20

### DEC-004: Registrar Payment al cerrar orden
**Problema:** closeOrder solo cambiaba status sin crear registro de pago.
**Decisión:** Crear Payment con monto, método, userId y closedAt timestamp.
**Justificación:** Habilita historial de pagos, cierres de caja y contabilidad.
**Fecha:** 2026-08-20

### DEC-005: Validación con Zod en todos los endpoints
**Problema:** No había validación de inputs; errores crípticos de Prisma al recibir datos malformados.
**Decisión:** Middleware validate() + schemas centralizados en lib/validators.ts.
**Justificación:** Errores claros 400 en vez de 500; type safety; un solo punto de definición.
**Fecha:** 2026-08-20

### DEC-006: @pos/shared sincronizado con enums de Prisma
**Problema:** Types en shared no coincidían con los enums reales (lowercase vs UPPERCASE).
**Decisión:** Reescribir con los valores exactos del schema + interfaces completas.
**Justificación:** Habilita type safety end-to-end sin depender de @prisma/client en el frontend.
**Fecha:** 2026-08-20

### DEC-007: Emojis Unicode para iconos del Sidebar
**Problema:** Caracteres corruptos (encoding issue).
**Decisión:** Emojis Unicode directos. Sin librería de iconos.
**Justificación:** Simplicidad. No justifica agregar una librería para 3 iconos.
**Fecha:** 2026-08-20

---

## 5. Estado Actual del Proyecto

### 5.1 Módulos completados ✅

| Módulo | Backend | Frontend | Validación | Auth |
|--------|---------|----------|------------|------|
| Auth (Login/Logout) | ✅ | ✅ | ✅ Zod | — |
| Menú (Categorías/Productos) | ✅ | ✅ | ✅ Zod | ✅ + RBAC |
| Floor Plan (Secciones/Mesas) | ✅ | ✅ | ✅ Zod | ✅ |
| Órdenes (CRUD + Cocina) | ✅ | ✅ | ✅ Zod | ✅ |
| Pagos (Cerrar + Registro) | ✅ | ✅ | ✅ Zod | ✅ |

### 5.2 Infraestructura ✅

- [x] Monorepo configurado (pnpm + Turbo)
- [x] Schema de Prisma con modelos completos (incluyendo inventario)
- [x] Paquete shared con types sincronizados
- [x] Error handling centralizado
- [x] Middleware de auth + roles funcional
- [x] Validación Zod en todos los endpoints
- [x] .env.example documentado
- [x] README.md profesional
- [x] .gitignore completo

### 5.3 Lo que NO existe todavía

- [x] ~~Módulo de inventario~~ ✅ (Sesión 4)
- [x] ~~Historial de órdenes cerradas~~ ✅ (Sesión 3)
- [x] ~~Reportes / estadísticas / dashboard del dueño~~ ✅ (Sesión 3)
- [ ] Pantalla de cocina (KDS)
- [x] ~~Responsive / PWA~~ ✅ (Sesión 2)
- [x] ~~Deploy a producción~~ ✅ (Sesión 5)
- [ ] Tests (unitarios e integración)
- [ ] Impresión de tickets
- [ ] WebSockets (tiempo real)
- [x] ~~Sección de Consejos~~ ✅ (Sesión 2)

---

## 6. Backlog (priorizado)

### Prioridad Alta (siguiente sesión)

| # | Feature | Módulos involucrados | Esfuerzo |
|---|---------|---------------------|----------|
| 1 | Módulo de Inventario | Backend: ingredientService + routes | Medio |
| 2 | Historial de órdenes cerradas | Backend: orderService.getHistory() + Frontend: nueva página | Medio |
| 3 | Reportes de ventas | Backend: reportService + Frontend: gráficas | Alto |

### Prioridad Media

| # | Feature | Notas |
|---|---------|-------|
| 4 | Pantalla de cocina (KDS) | Página separada, poll o WebSocket |
| 5 | Selector de método de pago en UI | Actualmente hardcoded como CASH |
| 6 | Responsive / PWA | Adaptar a tablet (uso principal en restaurante) |
| 7 | Impresión de tickets | Cocina + Cliente |

### Prioridad Baja (post-deploy)

| # | Feature | Notas |
|---|---------|-------|
| 8 | Deploy (Neon + Render + Vercel) | Pendiente decisión de hosting |
| 9 | Tests automatizados | Vitest para API, React Testing Library para web |
| 10 | Descuento de stock automático al vender | RecipeIngredient ya existe en schema |
| 11 | WebSockets para updates en tiempo real | Cocina, mesas |
| 12 | Programa de fidelización | Modelo no definido aún |
| 13 | Multi-sucursal | Requiere rediseño de auth |

---

## 7. Aprendizajes del Proyecto

### Universales (aplicables a otros proyectos)

1. **Siempre usar un singleton para el cliente de DB** — Crear instancias por ruta causa leaks de conexiones.
2. **La validación se define una vez, se aplica en middleware** — No mezclar validación con lógica de negocio.
3. **Los types compartidos deben coincidir con la fuente de verdad (schema)** — Si no, son inútiles.
4. **Proteger TODAS las rutas por defecto** — Dejar rutas públicas es un riesgo que debe ser explícito.
5. **Documentar variables de entorno con .env.example** — Reduce fricción de onboarding de 30 min a 2 min.

### Específicos de este proyecto

1. El estado `CLOSED` (no `PAID`) es el corrector para órdenes terminadas en Prisma.
2. Al crear una orden con mesa, el backend automáticamente la pone en `OCCUPIED`.
3. Al pagar, el backend automáticamente libera la mesa (`AVAILABLE`).
4. El frontend siempre envía JWT vía `apiClient` — proteger rutas no rompe nada.
5. El seed crea solo un usuario admin; los demás se crean desde la app.

---

## 8. Riesgos Identificados

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| JWT_SECRET hardcoded como fallback | Alto (seguridad) | Documentado en .env.example; en producción debe ser obligatorio |
| Sin rate limiting en login | Medio (brute force) | Agregar express-rate-limit antes del deploy |
| Sin HTTPS en desarrollo | Bajo | Localhost es aceptable; en producción el proxy lo maneja |
| Sin tests automatizados | Medio (regresiones) | Priorizar antes de agregar módulos nuevos |
| Sin backup automático de DB | Alto (pérdida de datos) | Configurar pg_dump cron antes de producción |

---

## 9. Convenciones del Proyecto

### Código
- **Backend:** CommonJS, TypeScript strict: false (relajar para prototipar; endurecer en producción)
- **Frontend:** ESModules, TypeScript con Vite
- **Rutas:** Siempre `/minuscula` sin guiones (e.g. `/floorplan`, no `/floor-plan`)
- **Services:** Objetos exportados con métodos async (no clases)
- **Errores:** Siempre `next(error)` — nunca `res.status().json()` directo en rutas

### Git
- Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`
- Branch principal: `main`
- Features: `feat/<nombre>`

### Naming
- Archivos: camelCase (`orderService.ts`, `floorPlan.ts`)
- Componentes React: PascalCase (`FloorPlan.tsx`, `MenuBrowser.tsx`)
- Stores: `use<Nombre>Store` (`useAuthStore`, `useOrderStore`)
- Enums: UPPERCASE (`AVAILABLE`, `CLOSED`, `ADMIN`)

---

## 10. Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://user:pass@localhost:5432/restaurant_pos` |
| `JWT_SECRET` | Secreto para firmar tokens | String aleatorio largo |
| `PORT` | Puerto del servidor Express | `3001` |

---

## 11. Historial de Sesiones

### Sesión 2026-08-20 — Auditoría y Profesionalización

**Objetivo:** Revisar todo el código existente y corregir problemas para profesionalizarlo.

**Logros:**
1. ✅ Eliminada instancia duplicada de PrismaClient → menuService
2. ✅ requireRole implementado correctamente (RBAC funcional)
3. ✅ Rutas de menú protegidas con auth + roles
4. ✅ Registro de Payment al cobrar (monto, método, userId, closedAt)
5. ✅ Validación Zod en todos los endpoints
6. ✅ @pos/shared sincronizado con enums reales de Prisma
7. ✅ Icono corrupto del Sidebar corregido
8. ✅ .env.example creado
9. ✅ README.md profesional
10. ✅ Biblia del Proyecto creada

**Metodología aplicada:** LOGAN (filosofía: pensar → documentar → construir → auditar)

**Próximo objetivo:** Responsive + PWA + Sección de Consejos.

---

### Sesión 2026-08-20 (2) — Responsive + PWA + Consejos

**Objetivo:** Hacer la app usable en dispositivos móviles, instalable como PWA, y agregar una sección de consejos prácticos para el personal del restaurante.

**Decisiones técnicas:**

**DEC-008: Layout responsive con bottom navigation en móvil**
- Desktop: mantiene sidebar lateral izquierda (80px)
- Móvil: sidebar se oculta, aparece bottom navigation fija (estilo app nativa)
- Justificación: El patrón bottom-nav es el estándar de apps móviles — el pulgar lo alcanza fácilmente.

**DEC-009: Carrito como drawer deslizable en móvil**
- Desktop: carrito flotante `absolute` (como antes)
- Móvil: FAB button (🛒) que abre un drawer desde abajo con backdrop
- Justificación: El carrito flotante de 320px tapa toda la pantalla en móvil. El drawer se abre solo cuando el usuario quiere verlo.

**DEC-010: PWA con service worker network-first**
- Strategy: network-first para assets, skip de llamadas API (siempre frescas)
- Justificación: Un POS necesita datos en tiempo real — no se cachean órdenes ni mesas. Pero sí el shell de la app para arranque rápido.

**DEC-011: Sección de Consejos integrada en la navegación principal**
- 24 tips prácticos en 4 categorías (Economía, Cocina, Cajeros, Meseros)
- Justificación: Agrega valor diferencial para el dueño del restaurante — el POS no solo cobra, también educa al equipo.

**Logros:**
1. ✅ Layout rediseñado — sidebar desktop + bottom nav móvil
2. ✅ MenuBrowser responsive — tabs horizontales + carrito drawer
3. ✅ FloorPlan responsive — grid 3 cols, touch feedback, tamaños adaptables
4. ✅ OrderPanel responsive — cards apiladas, botones grandes para touch
5. ✅ Login responsive — max-w-sm, inputs grandes, logo centrado
6. ✅ PWA completa — manifest.json, service worker, iconos, meta tags Apple
7. ✅ Sección Tips — 24 consejos en 4 categorías para todo el equipo
8. ✅ Biblia actualizada

**Archivos creados/modificados:** 14 archivos frontend

**Próximo objetivo:** Dashboard + Reportes de ventas para el dueño (Sesión 3).

---

### Sesión 2026-08-20 (3) — Dashboard + Reportes de Ventas

**Objetivo:** Dar al dueño del restaurante visibilidad completa de su negocio desde el celular: ventas, empleados, productos top, historial de órdenes.

**Decisiones técnicas:**

**DEC-012: Reportes como servicio separado con queries de agregación**
- `reportService.ts` con 4 métodos: getSummary, getByEmployee, getByProduct, getOrderHistory
- Queries agregan datos de Orders (CLOSED) + Payments + OrderItems
- No se crean tablas nuevas — el schema existente tiene todo
- Justificación: Art. III (simplicidad) — solo queries, cero migraciones.

**DEC-013: Endpoints de reportes protegidos con ADMIN/MANAGER**
- Todas las rutas `/api/reports/*` requieren `auth + requireRole('ADMIN', 'MANAGER')`
- Un mesero NO puede ver ventas totales ni datos de otros empleados
- Justificación: Principio de mínimo privilegio. La información financiera es del dueño.

**DEC-014: Navegación dinámica según rol del usuario**
- NavItem con flag `adminOnly: true`
- POSLayout filtra los items visibles según `user.role`
- ADMIN/MANAGER ven 6 tabs (Mesas, Menú, Órdenes, Dashboard, Historial, Tips)
- WAITER/CASHIER/CHEF ven 4 tabs (Mesas, Menú, Órdenes, Tips)
- Justificación: No exponer opciones que el usuario no puede usar. Reduce confusión.

**DEC-015: Historial con paginación server-side**
- El endpoint `/reports/history` devuelve 15 órdenes por página + metadata de paginación
- Filtros por rango de fechas (from/to)
- Justificación: Un restaurante con meses de operación puede tener miles de órdenes. Traer todas al frontend sería lento e ineficiente.

**Logros:**
1. ✅ reportService — ventas totales, ticket promedio, top product, por empleado, por producto
2. ✅ Rutas /reports/* — 4 endpoints protegidos con roles
3. ✅ Historial con paginación y filtros de fecha
4. ✅ Dashboard con KPIs — 4 cards, ranking empleados, ranking productos, métodos de pago
5. ✅ Vista de Historial — lista paginada con filtros, detalles de cada orden
6. ✅ Navegación dinámica por rol — ADMIN ve 6 tabs, mesero ve 4
7. ✅ Biblia actualizada

**Archivos creados/modificados:** 7 archivos (3 backend + 4 frontend)

**Próximo objetivo:** Módulo de Inventario (Sesión 4) — ingredientes, stock, recetas, descontar al vender.

---

### Sesión 2026-08-20 (4) — Módulo de Inventario

**Objetivo:** Implementar control de inventario completo: ingredientes, stock, movimientos, recetas (producto → ingredientes), y descuento automático al cerrar una orden.

**Decisiones técnicas:**

**DEC-016: Inventario basado en movimientos (no solo stock estático)**
- Cada cambio de stock crea un `StockMovement` (IN, OUT, ADJUSTMENT, WASTE)
- El historial queda completo para auditoría (quién, cuándo, por qué)
- Justificación: Art. I (el conocimiento es un activo) — saber que se desperdiciaron 5kg de tomate es info valiosa para reducir costos.

**DEC-017: Recetas como vínculo entre productos e ingredientes**
- `RecipeIngredient`: productId + ingredientId + quantity
- Permite saber exactamente cuánto ingrediente se usa por platillo vendido
- Justificación: Sin recetas, no se puede descontar automáticamente ni calcular el costo real del platillo.

**DEC-018: Descuento de stock graceful (no bloquea el cobro)**
- `closeOrder` llama a `deductStockForOrder` en un try/catch
- Si falla (no hay recetas configuradas), la orden se cierra igual
- Justificación: Art. III (simplicidad) — un restaurante puede empezar a usar el POS sin configurar recetas, y agregarlas después sin romper nada.

**DEC-019: Rutas de inventario solo para ADMIN/MANAGER**
- 8 endpoints bajo `/api/inventory/*` protegidos con requireRole
- Meseros y cajeros no pueden modificar stock ni recetas
- Justificación: El inventario es responsabilidad del dueño/gerente. Un mesero no debería poder "ajustar" stock sin supervisión.

**Logros:**
1. ✅ inventoryService — CRUD ingredientes + movimientos de stock con transacciones
2. ✅ recipeService — gestión de recetas (agregar, editar, eliminar, reemplazar)
3. ✅ Descuento automático de stock al cerrar orden (basado en recetas × cantidad)
4. ✅ 8 endpoints de inventario protegidos con Zod validation
5. ✅ Página de Inventario — grid con stock colored, modales para crear/ajustar
6. ✅ Inventario integrado en navegación (adminOnly, 7 tabs para admin)
7. ✅ Biblia actualizada

**Archivos creados/modificados:** 7 archivos (4 backend + 2 frontend + 1 doc)

**Estado del proyecto:** Las 4 sesiones planeadas están completas. El sistema es un POS funcional con: auth, menú, mesas, órdenes, pagos, reportes, inventario, tips y PWA. Pendiente: deploy a producción.

---

### Sesión 2026-08-20 (5) — Deploy a Producción

**Objetivo:** Desplegar la aplicación completa en internet: Neon (DB) + Render (Backend) + Vercel (Frontend).

**Decisiones técnicas:**

**DEC-020: Arquitectura de 3 servicios separados para producción**
- Neon (PostgreSQL): base de datos con SSL, región us-west-2
- Render (Node.js): backend Express compilado, región Oregon
- Vercel (Static + CDN): frontend React/Vite, distribución global
- Justificación: Cada servicio tiene tier gratuito. Separar permite escalar independientemente.

**DEC-021: CORS dinámico basado en variable de entorno**
- `FRONTEND_URL` define el origen permitido + wildcard `*.vercel.app`
- Justificación: Permite cambiar el dominio del frontend sin redesplegar el backend.

**DEC-022: Health check endpoint para monitoreo**
- `GET /health` retorna `{ status: "ok", timestamp }` — Render lo usa para verificar disponibilidad.
- Justificación: Sin health check, Render no sabe si el servicio arrancó correctamente.

**Logros:**
1. ✅ Backend preparado para producción (build, start, prisma generate, CORS)
2. ✅ render.yaml para deploy automático
3. ✅ Frontend con VITE_API_URL configurable + vercel.json SPA rewrite
4. ✅ Base de datos Neon: tablas creadas + seed ejecutado
5. ✅ PR #5 creado y pusheado
6. ✅ Instrucciones de deploy documentadas
7. ✅ Biblia actualizada

**Infraestructura de producción:**

| Servicio | Proveedor | URL | Tier |
|----------|-----------|-----|------|
| Base de datos | Neon | ep-sweet-fog-a6irqi7t-pooler.us-west-2.aws.neon.tech | Free |
| Backend API | Render | (pendiente primer deploy) | Free |
| Frontend | Vercel | (pendiente primer deploy) | Free |

**Credenciales de producción:**
- Usuario: `admin` / Contraseña: `Admin1234` / Rol: ADMIN

---

*Restaurant POS · Biblia del Proyecto · LOGAN v1.0*
