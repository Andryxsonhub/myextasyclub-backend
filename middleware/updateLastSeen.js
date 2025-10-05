const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Este middleware atualiza o campo 'lastSeen' do usuário no banco de dados
 * a cada requisição que ele faz a uma rota protegida.
 */
const updateLastSeen = async (req, res, next) => {
  // Se por algum motivo não houver um usuário na requisição,
  // apenas passamos para a próxima etapa sem fazer nada.
  if (!req.user || !req.user.userId) {
    return next();
  }

  try {
    const userId = req.user.userId;

    // Atualiza a data e hora do campo 'lastSeen' para o momento atual
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        lastSeen: new Date(),
      },
    });

  } catch (error) {
    // Mesmo que ocorra um erro ao atualizar o 'lastSeen',
    // não queremos que a requisição do usuário pare por causa disso.
    console.error('Falha ao atualizar a atividade do usuário:', error);
  } finally {
    // Continua para a próxima etapa da rota
    next();
  }
};

module.exports = updateLastSeen;