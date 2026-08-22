import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Admin user: password=Admin1234, PIN=1234
  const pass = await bcrypt.hash('Admin1234', 12);
  const pinHash = await bcrypt.hash('1234', 12);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { pin: '1234', pinHash },
    create: {
      username: 'admin',
      password: pass,
      name: 'Administrador',
      role: Role.ADMIN,
      pin: '1234',
      pinHash,
    }
  });
  console.log('Usuario admin creado/actualizado (PIN: 1234)');

  // Check if sections already exist (avoid duplicates on re-run)
  const existingSections = await prisma.section.count();
  if (existingSections === 0) {
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
    console.log('Datos de prueba creados (secciones, mesas, categorías, productos)');
  } else {
    console.log('Datos de prueba ya existen, saltando...');
  }

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
