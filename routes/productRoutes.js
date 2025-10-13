// myextasyclub-backend/routes/productRoutes.js

const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/products
 * @desc    Busca todos os planos de assinatura e pacotes de pimentas
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // Usamos Promise.all para buscar ambos os dados em paralelo, é mais eficiente!
    const [plans, packages] = await Promise.all([
      prisma.subscriptionPlan.findMany({
        orderBy: {
          priceInCents: 'asc', // Ordena do mais barato para o mais caro
        },
      }),
      prisma.pimentaPackage.findMany({
        orderBy: {
          priceInCents: 'asc',
        },
      }),
    ]);

    res.status(200).json({ plans, packages });
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar produtos.' });
  }
});

module.exports = router;