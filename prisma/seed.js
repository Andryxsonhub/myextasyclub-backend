// prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Lista dos pacotes de Pimentas que queremos vender
const packagesData = [
  {
    name: 'Apoio Quente',
    pimentaAmount: 1000,
    priceInCents: 990, // R$ 9,90
  },
  {
    name: 'Fogo Intenso',
    pimentaAmount: 5500,
    priceInCents: 4999, // R$ 49,99
  },
  {
    name: 'Explosão Vulcânica',
    pimentaAmount: 10000,
    priceInCents: 9990, // R$ 99,90
  },
];

async function main() {
  console.log(`Iniciando o seeding...`);

  for (const pkg of packagesData) {
    const existingPackage = await prisma.pimentaPackage.findFirst({
      where: { pimentaAmount: pkg.pimentaAmount },
    });
    
    // Só cria o pacote se ele ainda não existir
    if (!existingPackage) {
      const pimentaPackage = await prisma.pimentaPackage.create({
        data: pkg,
      });
      console.log(`Criado pacote: ${pimentaPackage.name} (${pimentaPackage.pimentaAmount} pimentas)`);
    } else {
      console.log(`Pacote de ${pkg.pimentaAmount} pimentas já existe. Pulando.`);
    }
  }
  
  console.log(`Seeding finalizado.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });