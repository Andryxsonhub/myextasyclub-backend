// Removida a criação de um novo PrismaClient daqui
const prisma = require('../lib/prisma'); // IMPORTA a instância única
const jwt = require('jsonwebtoken'); // Adicionado por precaução, se necessário no futuro

const updateLastSeen = async (req, res, next) => {
  if (req.user && req.user.userId) {
    try {
      // Usando a instância importada
      await prisma.user.update({
        where: { id: req.user.userId },
        data: { lastSeenAt: new Date() },
      });
    } catch (error) {
      console.error("Falha ao atualizar a atividade do usuário:", error);
    }
  }
  next();
};

module.exports = updateLastSeen;