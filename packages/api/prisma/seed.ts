import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const pass = await bcrypt.hash('Admin1234', 12);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: pass,
      name: 'Administrador',
      role: Role.ADMIN
    }
  });
  console.log('Usuario admin creado');

  const terraza = await prisma.section.create({ data: { name: 'Terraza', sort: 1 } });
  const interior = await prisma.section.create({ data: { name: 'Interior', sort: 2 } });

  await prisma.table.createMany({
    data: [
      { name: 'Mesa 1', capacity: 4, sectionId: terraza.id, posX: 20, posY: 30 },
      { name: 'Mesa 2', capacity: 4, sectionId: terraza.id, posX: 60, posY: 30 },
      { name: 'Mesa 3', capacity: 4, sectionId: terraza.id, posX: 40, posY: 70 },
      { name: 'Mesa 4', capacity: 2, sectionId: interior.id, posX: 20, posY: 30 },
      { name: 'Mesa 5', capacity: 4, sectionId: interior.id, posX: 50, posY: 30 },
      { name: 'Mesa 6', capacity: 8, sectionId: interior.id, posX: 35, posY: 70 },
    ]
  });

  const bebidas = await prisma.category.create({ data: { name: 'Bebidas', sort: 1 } });
  const platos = await prisma.category.create({ data: { name: 'Platillos', sort: 2 } });

  await prisma.product.createMany({
    data: [
      { categoryId: bebidas.id, name: 'Agua Natural', price: 25 },
      { categoryId: bebidas.id, name: 'Coca-Cola', price: 30 },
      { categoryId: bebidas.id, name: 'Cerveza', price: 55 },
      { categoryId: platos.id, name: 'Enchiladas', price: 120 },
      { categoryId: platos.id, name: 'Pollo a la Parrilla', price: 180 },
    ]
  });
  console.log('Seed completado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });