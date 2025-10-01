// routes/pimentaRoutes.js

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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