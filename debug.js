const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('--- INICIANDO SCRIPT DE DIAGNÓSTICO ---');
    console.log('Lendo a tabela de migrações...');

    const migrations = await prisma.$queryRaw`SELECT * FROM _prisma_migrations`;

    console.log('✅ SUCESSO! Conteúdo da tabela _prisma_migrations:');
    console.table(migrations);

  } catch (e) {
    console.error('❌ ERRO AO LER A TABELA DE MIGRAÇÕES:');
    console.error(e);
  } finally {
    await prisma.$disconnect();
    console.log('--- FIM DO SCRIPT DE DIAGNÓSTICO ---');
  }
}

main();