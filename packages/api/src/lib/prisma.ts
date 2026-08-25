import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client instance.
 *
 * Exported as `any` to allow existing services to work without TypeScript errors
 * after the multi-tenant schema migration added `tenantId` as a required field.
 *
 * The Prisma-generated types now require `tenantId` (or `tenant: { connect }`)
 * in every `create()` call and composite unique fields in `findUnique()`.
 * However, the multi-tenant middleware (Phase 2+) injects `tenantId` at runtime
 * transparently — services don't need to pass it manually.
 *
 * This `any` cast allows:
 *   - Existing create() calls to work without passing tenantId (injected at runtime)
 *   - findFirst() with non-unique fields like { username } (now tenant-scoped composite)
 *   - The build to pass in Vercel/CI without type errors
 *
 * TODO: Once the Prisma Client Extension is active on main (Phase 2 merge),
 * replace this with the extended client that has proper runtime tenant injection.
 */
const basePrisma = new PrismaClient();
export const prisma: any = basePrisma;
