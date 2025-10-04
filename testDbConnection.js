// testDbConnection.js

// Importa o Prisma Client
const { PrismaClient } = require('@prisma/client');
// Cria uma nova instância
const prisma = new PrismaClient();

// Cria uma função principal "async" para podermos usar "await"
async function main() {
  console.log('Tentando conectar ao banco de dados...');
  try {
    // Tenta fazer a consulta mais simples possível: contar os usuários
    const userCount = await prisma.user.count();
    // Se o comando acima funcionar, a conexão está boa
    console.log(`✅ Conexão com o banco de dados bem-sucedida!`);
    console.log(`   Encontrados ${userCount} usuários na tabela.`);

  } catch (error) {
    // Se der erro, o Prisma nos dará uma mensagem detalhada
    console.error('❌ Falha ao conectar com o banco de dados:');
    console.error(error); // ESTA É A MENSAGEM MAIS IMPORTANTE

  } finally {
    // Garante que a gente se desconecte do banco no final
    await prisma.$disconnect();
    console.log('Desconectado do banco de dados.');
  }
}

// Executa a função principal
main();