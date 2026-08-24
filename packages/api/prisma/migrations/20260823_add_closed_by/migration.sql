-- AlterTable: Add closedById to Order (who closed/charged the order)
ALTER TABLE "Order" ADD COLUMN "closedById" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
