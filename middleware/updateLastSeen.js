const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const updateLastSeen = async (req, res, next) => {
  // Verifica se existe um usuário logado na requisição
  if (req.user && req.user.userId) {
    try {
      const userId = req.user.userId;

      // Tenta atualizar o usuário correto
      await prisma.user.update({
        where: {
          id: userId // <-- CORREÇÃO 1: Usando o ID do usuário que fez a requisição
        },
        data: {
          lastSeenAt: new Date() // <-- CORREÇÃO 2: Usando o nome correto do campo ('lastSeenAt')
        }
      });

    } catch (error) {
      // Este middleware não deve quebrar a aplicação principal se falhar.
      // Apenas registramos o erro no console do servidor para análise.
      console.error("Falha ao atualizar a atividade do usuário:", error);
    }
  }

  // Continua para a próxima etapa, seja outro middleware ou a rota final
  next();
};

module.exports = updateLastSeen;