// prisma/seed.js
// --- CÓDIGO COMPLETO E CORRIGIDO ---

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); // <--- ADICIONE ESTA LINHA QUE FALTAVA
const prisma = new PrismaClient();

// Dados dos Planos de Assinatura (Exemplo)
// Adicione ou modifique conforme seus planos reais
const plansData = [
  {
    name: 'Semanal', // Usaremos 'name' como identificador único
    priceInCents: 890,
    // durationInDays: 7 // Removido se não existe no schema
  },
  {
    name: 'Mensal',
    priceInCents: 2990,
    // durationInDays: 30
  },
  {
    name: 'Anual',
    priceInCents: 29990,
    // durationInDays: 365
  },
];

// Dados dos Pacotes de Pimenta (Exemplo)
// Adicione ou modifique conforme seus pacotes reais
const packagesData = [
  {
    name: 'Apoio Quente', // Usaremos 'name' como identificador único
    pimentaAmount: 100,
    priceInCents: 990,
  },
  {
    name: 'Pacote Essencial',
    pimentaAmount: 500,
    priceInCents: 3990,
  },
  {
    name: 'Pacote Premium',
    pimentaAmount: 1200,
    priceInCents: 8990,
  },
];


async function main() {
  console.log('Iniciando o seeding...');

  // --- Garantir Planos de Assinatura no Banco ---
  console.log('Verificando planos de assinatura...');
  for (const plan of plansData) {
    await prisma.subscriptionPlan.upsert({
      where: {
          // --- CORREÇÃO: Usa 'name' em vez de 'id' ---
          name: plan.name
      },
      update: { // O que atualizar se o plano com esse nome já existir
          priceInCents: plan.priceInCents,
          // durationInDays: plan.durationInDays, // Removido se não existe
      },
      create: { // O que criar se o plano com esse nome não existir
          // --- CORREÇÃO: Não define o 'id' manualmente ---
          name: plan.name,
          priceInCents: plan.priceInCents,
          // durationInDays: plan.durationInDays, // Removido se não existe
      }
    });
    console.log(`Plano "${plan.name}" garantido.`);
  }

  // --- Garantir Pacotes de Pimenta no Banco ---
  console.log('Verificando pacotes de pimenta...');
  for (const pkg of packagesData) {
    await prisma.pimentaPackage.upsert({
       where: {
          // --- CORREÇÃO: Usa 'name' em vez de 'id' ---
           name: pkg.name
       },
       update: { // O que atualizar se o pacote já existir
           pimentaAmount: pkg.pimentaAmount,
           priceInCents: pkg.priceInCents,
       },
       create: { // O que criar se o pacote não existir
          // --- CORREÇÃO: Não define o 'id' manualmente ---
           name: pkg.name,
           pimentaAmount: pkg.pimentaAmount,
           priceInCents: pkg.priceInCents,
       }
    });
    console.log(`Pacote "${pkg.name}" garantido.`);
  }

  // --- Adicionar Usuários de Teste (Opcional, mas recomendado) ---
  console.log('Criando usuários de teste...');
  try {
      const user1 = await prisma.user.upsert({
          where: { email: 'teste1@email.com' },
          update: {},
          create: {
              email: 'teste1@email.com',
              name: 'Anderson Santos',
              password: await bcrypt.hash('senha123', 10), // Agora o bcrypt está importado
              profile: { create: { bio: 'Bio do Teste 1', location: 'Cidade A', gender: 'Masculino' } }
          },
      });
      const user2 = await prisma.user.upsert({
          where: { email: 'teste2@email.com' },
          update: {},
          create: {
              email: 'teste2@email.com',
              name: 'Juliana Silva',
              password: await bcrypt.hash('senha123', 10),
              profile: { create: { bio: 'Bio do Teste 2', location: 'Cidade B', gender: 'Feminino' } }
          },
      });
      console.log('Usuários de teste criados:', user1.email, user2.email);
  } catch (userError) {
      console.error("Erro ao criar usuários de teste:", userError);
  }


  console.log('Seeding finalizado.');
}

main()
  .catch((e) => {
    console.error('Erro durante o seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });