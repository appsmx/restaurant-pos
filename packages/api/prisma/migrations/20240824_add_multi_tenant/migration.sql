-- Migration: Add Multi-Tenant Support
-- Description: Creates Tenant model, adds tenantId to all existing tables,
--              and migrates existing data to the default "quiroa" tenant.
-- IMPORTANT: This migration is designed to be safe for existing production data.
--            It uses a 3-step approach: 1) Create tenant, 2) Add nullable columns,
--            3) Backfill data, 4) Make columns NOT NULL + add constraints.

-- ============================================================================
-- STEP 1: Create enums and Tenant table
-- ============================================================================

-- Create new enums
CREATE TYPE "BusinessType" AS ENUM ('RESTAURANT', 'BARBERSHOP', 'CAFE', 'STORE', 'GENERAL');
CREATE TYPE "Plan" AS ENUM ('STARTER', 'GROWTH', 'PRO');

-- Create Tenant table
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessType" "BusinessType" NOT NULL DEFAULT 'RESTAURANT',
    "plan" "Plan" NOT NULL DEFAULT 'STARTER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "enabledModules" TEXT[],
    "config" JSONB NOT NULL DEFAULT '{}',
    "setupFee" DOUBLE PRECISION NOT NULL DEFAULT 3000,
    "monthlyRate" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "setupPaid" BOOLEAN NOT NULL DEFAULT false,
    "billingStartAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- Unique index on slug
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- ============================================================================
-- STEP 2: Insert the default tenant (Mariscos Quiroa)
-- ============================================================================

INSERT INTO "Tenant" ("id", "slug", "name", "businessType", "plan", "active", "enabledModules", "config", "setupFee", "monthlyRate", "setupPaid", "createdAt", "updatedAt")
VALUES (
    'tenant_quiroa_001',
    'quiroa',
    'Mariscos Quiroa',
    'RESTAURANT',
    'PRO',
    true,
    ARRAY['kitchen', 'bar', 'floorPlan', 'inventory', 'loyalty', 'delivery', 'recipes', 'digitalMenu'],
    '{"terminology": {"table": "mesa", "order": "orden", "product": "platillo", "kitchen": "cocina"}}',
    5000,
    1500,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- ============================================================================
-- STEP 3: Add tenantId column (NULLABLE first) to all existing tables
-- ============================================================================

ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Session" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Category" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Product" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ModifierGroup" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "ModifierItem" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Section" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Table" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Order" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "OrderItemModifier" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Ingredient" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "RecipeIngredient" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "SyncQueue" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "CashRegister" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "CashMovement" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "OrderEvent" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "RestaurantConfig" ADD COLUMN "tenantId" TEXT;

-- ============================================================================
-- STEP 4: Backfill all existing data with the default tenant
-- ============================================================================

UPDATE "User" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "Session" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "Category" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "Product" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "ModifierGroup" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "ModifierItem" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "Section" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "Table" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "Order" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "OrderItem" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "OrderItemModifier" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "Payment" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "Ingredient" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "RecipeIngredient" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "StockMovement" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "SyncQueue" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "CashRegister" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "CashMovement" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "Customer" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "OrderEvent" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;
UPDATE "RestaurantConfig" SET "tenantId" = 'tenant_quiroa_001' WHERE "tenantId" IS NULL;

-- ============================================================================
-- STEP 5: Make tenantId NOT NULL now that all rows have a value
-- ============================================================================

ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Session" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ModifierGroup" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "ModifierItem" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Section" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Table" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "OrderItem" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "OrderItemModifier" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Ingredient" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "RecipeIngredient" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "StockMovement" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "SyncQueue" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CashRegister" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CashMovement" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "OrderEvent" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "RestaurantConfig" ALTER COLUMN "tenantId" SET NOT NULL;

-- ============================================================================
-- STEP 6: Add foreign key constraints (tenantId → Tenant.id)
-- ============================================================================

ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModifierItem" ADD CONSTRAINT "ModifierItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Section" ADD CONSTRAINT "Section_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Table" ADD CONSTRAINT "Table_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncQueue" ADD CONSTRAINT "SyncQueue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantConfig" ADD CONSTRAINT "RestaurantConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- STEP 7: Drop old unique constraints that are now tenant-scoped
-- ============================================================================

-- User.username was globally unique, now scoped to tenant
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_username_key";

-- User.pin was globally unique, now scoped to tenant  
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_pin_key";

-- RestaurantConfig now keyed by tenantId (1 config per tenant)
-- Drop the old singleton id default if exists, add unique on tenantId
CREATE UNIQUE INDEX "RestaurantConfig_tenantId_key" ON "RestaurantConfig"("tenantId");

-- ============================================================================
-- STEP 8: Create new composite unique constraints and indexes
-- ============================================================================

-- User: unique username per tenant, unique pin per tenant
CREATE UNIQUE INDEX "User_tenantId_username_key" ON "User"("tenantId", "username");
CREATE UNIQUE INDEX "User_tenantId_pin_key" ON "User"("tenantId", "pin");

-- Performance indexes for multi-tenant queries
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "Session_tenantId_idx" ON "Session"("tenantId");
CREATE INDEX "Category_tenantId_idx" ON "Category"("tenantId");
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");
CREATE INDEX "Product_tenantId_categoryId_idx" ON "Product"("tenantId", "categoryId");
CREATE INDEX "ModifierGroup_tenantId_idx" ON "ModifierGroup"("tenantId");
CREATE INDEX "ModifierItem_tenantId_idx" ON "ModifierItem"("tenantId");
CREATE INDEX "Section_tenantId_idx" ON "Section"("tenantId");
CREATE INDEX "Table_tenantId_idx" ON "Table"("tenantId");
CREATE INDEX "Table_tenantId_sectionId_idx" ON "Table"("tenantId", "sectionId");
CREATE INDEX "Order_tenantId_idx" ON "Order"("tenantId");
CREATE INDEX "Order_tenantId_status_idx" ON "Order"("tenantId", "status");
CREATE INDEX "Order_tenantId_createdAt_idx" ON "Order"("tenantId", "createdAt");
CREATE INDEX "Order_tenantId_ticketNumber_idx" ON "Order"("tenantId", "ticketNumber");
CREATE INDEX "OrderItem_tenantId_idx" ON "OrderItem"("tenantId");
CREATE INDEX "OrderItemModifier_tenantId_idx" ON "OrderItemModifier"("tenantId");
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");
CREATE INDEX "Payment_tenantId_createdAt_idx" ON "Payment"("tenantId", "createdAt");
CREATE INDEX "Ingredient_tenantId_idx" ON "Ingredient"("tenantId");
CREATE INDEX "RecipeIngredient_tenantId_idx" ON "RecipeIngredient"("tenantId");
CREATE INDEX "StockMovement_tenantId_idx" ON "StockMovement"("tenantId");
CREATE INDEX "StockMovement_tenantId_createdAt_idx" ON "StockMovement"("tenantId", "createdAt");
CREATE INDEX "SyncQueue_tenantId_idx" ON "SyncQueue"("tenantId");
CREATE INDEX "SyncQueue_tenantId_status_idx" ON "SyncQueue"("tenantId", "status");
CREATE INDEX "CashRegister_tenantId_idx" ON "CashRegister"("tenantId");
CREATE INDEX "CashRegister_tenantId_status_idx" ON "CashRegister"("tenantId", "status");
CREATE INDEX "CashMovement_tenantId_idx" ON "CashMovement"("tenantId");
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");
CREATE INDEX "Customer_tenantId_phone_idx" ON "Customer"("tenantId", "phone");
CREATE INDEX "OrderEvent_tenantId_idx" ON "OrderEvent"("tenantId");
