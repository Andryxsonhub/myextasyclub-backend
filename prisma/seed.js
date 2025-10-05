// backend/prisma/seed.js (O CÓDIGO CORRETO PARA ESTE ARQUIVO)

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const packagesData = [
  {
    id: 1,
    name: 'Apoio Quente',
    pimentaAmount: 1000,
    priceInCents: 990,
  },
  {
    id: 2,
    name: 'Fogo Intenso',
    pimentaAmount: 7500,
    priceInCents: 4999,
  },
  {
    id: 3,
    name: 'Explosão Vulcânica',
    pimentaAmount: 15000,
    priceInCents: 9990,
  },
];

async function main() {
  console.log('Iniciando o seeding...');

  for (const pkg of packagesData) {
    await prisma.pimentaPackage.upsert({
      where: { id: pkg.id },
      update: { 
        name: pkg.name,
        pimentaAmount: pkg.pimentaAmount,
        priceInCents: pkg.priceInCents,
      },
      create: pkg,
    });
    console.log(`Pacote '${pkg.name}' garantido no banco com ${pkg.pimentaAmount} pimentas.`);
  }
  
  console.log(`Seeding finalizado com sucesso!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });