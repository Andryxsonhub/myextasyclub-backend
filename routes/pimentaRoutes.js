const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma'); // IMPORTA a instância única

// As linhas 'PrismaClient' e 'new PrismaClient()' foram REMOVIDAS daqui

// Rota para buscar todos os pacotes de pimentas
// GET /api/pimentas/packages
router.get('/packages', async (req, res) => {
  try {
    const packages = await prisma.pimentaPackage.findMany({
      orderBy: {
        priceInCents: 'asc', // Ordena do mais barato para o mais caro
      },
    });
    res.status(200).json(packages);
  } catch (error) {
    console.error('Erro ao buscar pacotes de pimentas:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar pacotes.' });
  }
});

module.exports = router;