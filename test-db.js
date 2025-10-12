// Arquivo: test-db.js

require('dotenv').config(); // Carrega as variáveis do seu arquivo .env
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando teste de conexão com o banco de dados...');
  console.log('Usando DATABASE_URL:', process.env.DATABASE_URL); // Mostra a URL que está sendo usada

  try {
    console.log('\nPasso 1: Tentando conectar ao banco de dados...');
    await prisma.$connect();
    console.log('✅ Conexão com o banco de dados bem-sucedida!');
    
    console.log('\nPasso 2: Tentando buscar pacotes...');
    const packages = await prisma.pimentaPackage.findMany();
    console.log(`📦 Sucesso! Encontrados ${packages.length} pacotes.`);
    if (packages.length > 0) {
      console.log('Exemplo de pacote:', packages[0]);
    }

  } catch (e) {
    console.error('\n❌❌❌ FALHA NO TESTE ❌❌❌');
    console.error('Ocorreu um erro ao tentar conectar ou buscar dados:');
    console.error(e);
  } finally {
    await prisma.$disconnect();
    console.log('\nTeste finalizado. Desconectado do banco de dados.');
  }
}

main();