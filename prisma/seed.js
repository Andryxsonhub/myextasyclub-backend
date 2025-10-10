// backend/prisma/seed.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Seus pacotes de pimentas
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

// Nossos novos planos de assinatura
const plansData = [
    {
      id: 'semanal',
      name: 'Semanal',
      priceInCents: 890, // R$ 8,90
      durationInDays: 7,
    },
    {
      id: 'mensal',
      name: 'Mensal',
      priceInCents: 2890, // R$ 28,90
      durationInDays: 30,
    },
    {
      id: 'anual',
      name: 'Anual',
      priceInCents: 29890, // R$ 298,90
      durationInDays: 365,
    },
];

async function main() {
  console.log('Iniciando o seeding...');

  // --- Garantir Planos de Assinatura no Banco ---
  console.log('Verificando planos de assinatura...');
  for (const plan of plansData) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        priceInCents: plan.priceInCents,
        durationInDays: plan.durationInDays
      },
      create: plan,
    });
    console.log(`Plano '${plan.name}' garantido no banco.`);
  }
  
  // --- Garantir Pacotes de Pimentas no Banco ---
  console.log('\nVerificando pacotes de pimentas...');
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
  
  console.log(`\nSeeding finalizado com sucesso!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });